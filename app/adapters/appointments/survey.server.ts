import type { Kysely } from "kysely";

import {
  remainingOf,
  windowKey,
  type ResponseOverview,
  type Slot,
  type SlotWindow,
} from "../../core/domain/availability.ts";
import { stateAfterAnswer, type SurveyState } from "../../core/domain/survey.ts";
import { rowToRange } from "../../core/domain/time/time-range.ts";
import type { Database } from "../../database/types.ts";
import { logAudit, SYSTEM_ACTOR } from "../../lib/infra/logging.ts";
import { nextCalendarSequence } from "./appointments.server.ts";
import { readAvailability } from "./availability.server.ts";
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
  proposedSlots: Slot[];
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

// What the rules in stateAfterAnswer() need. Call it in the transaction that saves the answer: it
// locks the appointment row, so no other answer can change what is left meanwhile.
async function readSurveyState(trx: Executor, answer: Answer): Promise<SurveyState> {
  const nothing = { minDurationMinutes: null, slots: [], answers: [] };
  const open = await trx
    .selectFrom("appointment")
    .select("id")
    .where("id", "=", answer.appointmentId)
    .where("status", "=", "open")
    .forUpdate()
    .executeTakeFirst();
  if (!open) return { open: false, alreadyAnswered: false, ...nothing };

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
    if (!known || responded) return { open: true, alreadyAnswered: true, ...nothing };
  }

  const { minDurationMinutes, slots } = await readAvailability(
    trx,
    answer.appointmentId,
    answer.participantId,
  );
  return {
    open: true,
    alreadyAnswered: false,
    minDurationMinutes,
    slots: slots.map(({ id, start, end }) => ({ id, start, end })),
    answers: slots.flatMap(({ id, responses }) =>
      responses.map(({ windows }) => ({ slotId: id, windows })),
    ),
  };
}

// Stores one yes or no per slot that still has a remaining window, and the availability windows of
// every yes. Without a participantId a new participant is created,
// which is what the universal link does.
export async function saveAnswer(db: Executor, answer: Answer): Promise<SaveResult> {
  const result = await db.transaction().execute(async (trx): Promise<SaveResult> => {
    const outcome = stateAfterAnswer(await readSurveyState(trx, answer), answer.availability);
    if (!outcome.ok) return { saved: false, reason: outcome.reason };
    const { responses, windows, cancelled } = outcome.answer;

    const participantId =
      answer.participantId ??
      (
        await trx
          .insertInto("participant")
          .values({ appointment_id: answer.appointmentId, name: answer.name, type: "universal" })
          .returning("id")
          .executeTakeFirstOrThrow()
      ).id;

    if (responses.length > 0) {
      const saved = await trx
        .insertInto("participant_response")
        .values(
          responses.map(({ slotId, available }) => ({
            participant_id: participantId,
            slot_id: slotId,
            status: available ? ("yes" as const) : ("no" as const),
          })),
        )
        .returning(["id", "slot_id"])
        .execute();

      if (windows.length > 0) {
        const responseIds = new Map(saved.map(({ id, slot_id }) => [slot_id, id]));
        await trx
          .insertInto("participant_response_window")
          .values(
            windows.map(({ slotId, start, end }) => ({
              response_id: responseIds.get(slotId)!,
              start_time: start,
              end_time: end,
            })),
          )
          .execute();
      }
    }

    if (cancelled) {
      await trx
        .updateTable("appointment")
        .set({ status: "cancelled", updated_at: new Date() })
        .where("id", "=", answer.appointmentId)
        .execute();
      logAudit("appointment.cancelled", {
        actorId: SYSTEM_ACTOR,
        appointmentId: answer.appointmentId,
        reason: "no window left",
      });
    }
    return { saved: true, participantId };
  });
  if (result.saved) {
    logAudit("participant.answered", {
      actorId: result.participantId,
      appointmentId: answer.appointmentId,
      participantId: result.participantId,
    });
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
