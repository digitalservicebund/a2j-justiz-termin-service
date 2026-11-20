import type { Kysely } from "kysely";

import { checkAvailability, windowKey, type SlotWindow } from "../../core/domain/availability.ts";
import { rowToRange } from "../../core/domain/time/time-range.ts";
import type { Database } from "../../database/types.ts";
import { logInfo } from "../../lib/logging.ts";
import { nextCalendarSequence, type AppointmentSlot } from "./appointments.server.ts";
import { readAvailability, remainingOf, type AnsweredSlot } from "./availability.server.ts";
import { participantName } from "./participants.server.ts";

// A window a guest can answer or has answered: a remaining window of a slot, or an availability
// window within one. The id is its window key.
export type SurveySlot = SlotWindow & { id: string };

export type Survey = {
  appointmentId: string;
  aktenzeichen: string;
  // The shortest an availability window may be.
  minDurationMinutes: number | null;
  // The guest behind a personal link. Behind the universal link guests give their name themselves.
  participant?: { id: string; name: string };
  // A personal link can answer once; the universal link starts a new participant every time.
  answered: boolean;
  // What is left of the proposed slots after the answers of the other participants.
  slots: SurveySlot[];
  // Every slot the judge proposed, also those ruled out. Only the sorry page lists them.
  proposedSlots: AppointmentSlot[];
};

type Executor = Kysely<Database>;

const toSurveySlot = (window: SlotWindow): SurveySlot => ({ id: windowKey(window), ...window });

// The token is either the secret of a personal link or the universal_token of the appointment.
// Returns undefined unless the appointment is open for replies, or cancelled: then every window is
// ruled out, and guests are told so instead of finding nothing.
export async function findSurvey(db: Executor, token: string): Promise<Survey | undefined> {
  const personal = await db
    .selectFrom("participant")
    .select(["id", participantName, "appointment_id"])
    .where("token", "=", token)
    .executeTakeFirst();

  const appointment = await db
    .selectFrom("appointment")
    .select(["id", "aktenzeichen", "min_duration_minutes"])
    .$call((qb) =>
      personal
        ? qb.where("id", "=", personal.appointment_id)
        : qb.where("universal_token", "=", token),
    )
    .where("status", "in", ["open", "cancelled"])
    .executeTakeFirst();
  if (!appointment) return undefined;

  const answered = personal
    ? Boolean(
        await db
          .selectFrom("participant_response")
          .select("id")
          .where("participant_id", "=", personal.id)
          .executeTakeFirst(),
      )
    : false;

  // Your own earlier answer must not take anything away from you.
  const availability = await readAvailability(db, appointment.id, personal?.id);
  return {
    appointmentId: appointment.id,
    aktenzeichen: appointment.aktenzeichen,
    minDurationMinutes: appointment.min_duration_minutes,
    participant: personal ? { id: personal.id, name: personal.name } : undefined,
    answered,
    slots: remainingOf(availability).map(toSurveySlot),
    proposedSlots: availability.slots.map(({ id, start, end }) => ({ id, start, end })),
  };
}

export type Answer = {
  appointmentId: string;
  // Display name of the guest for the personal link, or the name entered behind the universal link.
  name: string;
  participantId?: string;
  // When the guest is available. Every window has to lie within a remaining window of its slot.
  availability: SlotWindow[];
};

export type SaveResult =
  | { saved: true; participantId: string }
  | { saved: false; reason: "closed" | "answered" | "unavailable" };

// Stores one yes or no per slot that still has a remaining window, and the availability windows of
// every yes. Without a participantId a new participant is created,
// which is what the universal link does.
export async function saveAnswer(db: Executor, answer: Answer): Promise<SaveResult> {
  const result = await db.transaction().execute(async (trx): Promise<SaveResult> => {
    const open = await trx
      .selectFrom("appointment")
      .select("id")
      .where("id", "=", answer.appointmentId)
      .where("status", "=", "open")
      .forUpdate()
      .executeTakeFirst();
    if (!open) return { saved: false, reason: "closed" };

    if (answer.participantId) {
      const known = await trx
        .selectFrom("participant")
        .select("id")
        .where("id", "=", answer.participantId)
        .where("appointment_id", "=", answer.appointmentId)
        .forUpdate()
        .executeTakeFirst();
      const responded = await trx
        .selectFrom("participant_response")
        .select("id")
        .where("participant_id", "=", answer.participantId)
        .executeTakeFirst();
      if (!known || responded) return { saved: false, reason: "answered" };
    }

    // The appointment row is locked, so no other answer can change what is left meanwhile.
    const before = await readAvailability(trx, answer.appointmentId, answer.participantId);
    const offered = remainingOf(before);
    const checked = checkAvailability(answer.availability, offered, before.minDurationMinutes);
    if (!checked.ok) return { saved: false, reason: "unavailable" };

    const participantId =
      answer.participantId ??
      (
        await trx
          .insertInto("participant")
          .values({ appointment_id: answer.appointmentId, name: answer.name, type: "universal" })
          .returning("id")
          .executeTakeFirstOrThrow()
      ).id;

    const slotIds = [...new Set(offered.map(({ slotId }) => slotId))];
    if (slotIds.length > 0) {
      const available = new Set(checked.windows.map(({ slotId }) => slotId));
      const responses = await trx
        .insertInto("participant_response")
        .values(
          slotIds.map((slotId) => ({
            participant_id: participantId,
            slot_id: slotId,
            status: available.has(slotId) ? ("yes" as const) : ("no" as const),
          })),
        )
        .returning(["id", "slot_id"])
        .execute();

      if (checked.windows.length > 0) {
        const responseIds = new Map(responses.map(({ id, slot_id }) => [slot_id, id]));
        await trx
          .insertInto("participant_response_window")
          .values(
            checked.windows.map(({ slotId, start, end }) => ({
              response_id: responseIds.get(slotId)!,
              start_time: start,
              end_time: end,
            })),
          )
          .execute();
      }
    }

    // Without a window everyone can attend, the appointment is off.
    if (remainingOf(await readAvailability(trx, answer.appointmentId)).length === 0) {
      await trx
        .updateTable("appointment")
        .set({ status: "cancelled", updated_at: new Date() })
        .where("id", "=", answer.appointmentId)
        .execute();
      logInfo(`Appointment ${answer.appointmentId} cancelled: no window is left`);
    }
    return { saved: true, participantId };
  });
  if (result.saved) {
    logInfo(`Participant ${result.participantId} answered appointment ${answer.appointmentId}`);
  }
  return result;
}

export type SavedAnswer = { name: string; available: SurveySlot[] };

// The availability windows a participant of the appointment gave. Undefined for strangers and for
// participants of a personal link who have not answered yet.
export async function getSavedAnswer(
  db: Executor,
  appointmentId: string,
  participantId: string,
): Promise<SavedAnswer | undefined> {
  const participant = await db
    .selectFrom("participant")
    .select([participantName, "type"])
    .where("id", "=", participantId)
    .where("appointment_id", "=", appointmentId)
    .executeTakeFirst();
  if (!participant) return undefined;

  const rows = await db
    .selectFrom("participant_response_window")
    .innerJoin(
      "participant_response",
      "participant_response.id",
      "participant_response_window.response_id",
    )
    .select([
      "participant_response.slot_id",
      "participant_response_window.start_time",
      "participant_response_window.end_time",
    ])
    .where("participant_response.participant_id", "=", participantId)
    .orderBy("participant_response_window.start_time")
    .execute();

  const responded =
    rows.length > 0 ||
    participant.type === "universal" ||
    Boolean(
      await db
        .selectFrom("participant_response")
        .select("id")
        .where("participant_id", "=", participantId)
        .executeTakeFirst(),
    );
  if (!responded) return undefined;

  return {
    name: participant.name,
    available: rows.map((row) => toSurveySlot({ slotId: row.slot_id, ...rowToRange(row) })),
  };
}

export type ResponseOverview = {
  appointmentId: string;
  aktenzeichen: string;
  // The judge who created the appointment.
  judgeEmail: string;
  // The SEQUENCE for the calendar file that goes with this state.
  calendarSequence: number;
  // Every proposed slot with the answers given for it and what is left of it.
  slots: AnsweredSlot[];
};

// Where the appointment stands after the latest answer, for the calendar file that goes to the
// judge. Takes the next SEQUENCE and reads the answers in one transaction: answers are saved under
// a lock on the same row, so a higher SEQUENCE never carries older answers than a lower one.
// Undefined for an unknown appointment.
export function issueResponseOverview(
  db: Executor,
  appointmentId: string,
): Promise<ResponseOverview | undefined> {
  return db.transaction().execute(async (trx) => {
    const calendarSequence = await nextCalendarSequence(trx, appointmentId);
    if (calendarSequence === undefined) return undefined;
    return readResponseOverview(trx, appointmentId, calendarSequence);
  });
}

async function readResponseOverview(
  db: Executor,
  appointmentId: string,
  calendarSequence: number,
): Promise<ResponseOverview | undefined> {
  const appointment = await db
    .selectFrom("appointment")
    .innerJoin("user", "user.id", "appointment.user_id")
    .select(["appointment.id", "appointment.aktenzeichen", "user.email"])
    .where("appointment.id", "=", appointmentId)
    .executeTakeFirst();
  if (!appointment) return undefined;

  return {
    appointmentId: appointment.id,
    aktenzeichen: appointment.aktenzeichen,
    judgeEmail: appointment.email,
    calendarSequence,
    slots: (await readAvailability(db, appointmentId)).slots,
  };
}
