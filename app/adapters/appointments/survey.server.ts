import type { Kysely } from "kysely";

import { rowToRange } from "../../core/domain/time/time-range.ts";
import type { Database } from "../../database/types.ts";
import { logInfo } from "../../lib/logging.ts";
import { nextCalendarSequence, type AppointmentSlot } from "./appointments.server.ts";
import { participantName } from "./participants.server.ts";

export type SurveySlot = { id: string; start: Date; end: Date };

export type Survey = {
  appointmentId: string;
  aktenzeichen: string;
  // The guest behind a personal link. Behind the universal link guests give their name themselves.
  participant?: { id: string; name: string };
  // A personal link can answer once; the universal link starts a new participant every time.
  answered: boolean;
  // The proposed windows, without those another participant already ruled out.
  slots: SurveySlot[];
  // Every window the judge proposed, also those ruled out. Only the sorry page lists them.
  proposedSlots: SurveySlot[];
};

type Executor = Kysely<Database>;

// A window nobody else can attend is no option for anyone, so it is not offered any more.
function visibleSlots(db: Executor, appointmentId: string, ownParticipantId?: string) {
  return db
    .selectFrom("time_slot")
    .select(["id", "start_time", "end_time"])
    .where("appointment_id", "=", appointmentId)
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("participant_response")
            .innerJoin("participant", "participant.id", "participant_response.participant_id")
            .select("participant_response.id")
            .whereRef("participant_response.slot_id", "=", "time_slot.id")
            .where("participant_response.status", "=", "no")
            // Your own earlier answer must not hide the window from you.
            .$if(ownParticipantId !== undefined, (qb) =>
              qb.where("participant.id", "!=", ownParticipantId!),
            ),
        ),
      ),
    )
    .orderBy("start_time")
    .execute()
    .then((rows) => rows.map((row): SurveySlot => ({ id: row.id, ...rowToRange(row) })));
}

function proposedSlots(db: Executor, appointmentId: string) {
  return db
    .selectFrom("time_slot")
    .select(["id", "start_time", "end_time"])
    .where("appointment_id", "=", appointmentId)
    .orderBy("start_time")
    .execute()
    .then((rows) => rows.map((row): SurveySlot => ({ id: row.id, ...rowToRange(row) })));
}

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
    .select(["id", "aktenzeichen"])
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

  return {
    appointmentId: appointment.id,
    aktenzeichen: appointment.aktenzeichen,
    participant: personal ? { id: personal.id, name: personal.name } : undefined,
    answered,
    slots: await visibleSlots(db, appointment.id, personal?.id),
    proposedSlots: await proposedSlots(db, appointment.id),
  };
}

export type Answer = {
  appointmentId: string;
  // Display name of the guest for the personal link, or the name entered behind the universal link.
  name: string;
  participantId?: string;
  availableSlotIds: string[];
};

export type SaveResult =
  | { saved: true; participantId: string }
  | { saved: false; reason: "closed" | "answered" | "unavailable" };

// Stores one yes or no per offered window. Without a participantId a new participant is created,
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

    const slots = await visibleSlots(trx, answer.appointmentId, answer.participantId);
    const offered = new Set(slots.map(({ id }) => id));
    if (answer.availableSlotIds.some((id) => !offered.has(id))) {
      return { saved: false, reason: "unavailable" };
    }

    const participantId =
      answer.participantId ??
      (
        await trx
          .insertInto("participant")
          .values({ appointment_id: answer.appointmentId, name: answer.name, type: "universal" })
          .returning("id")
          .executeTakeFirstOrThrow()
      ).id;

    if (slots.length > 0) {
      const available = new Set(answer.availableSlotIds);
      await trx
        .insertInto("participant_response")
        .values(
          slots.map(({ id }) => ({
            participant_id: participantId,
            slot_id: id,
            status: available.has(id) ? ("yes" as const) : ("no" as const),
          })),
        )
        .execute();
    }

    // Without a window anyone can still attend, the appointment is off.
    if ((await visibleSlots(trx, answer.appointmentId)).length === 0) {
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

// What a participant of the appointment said yes to. Undefined for strangers and for participants
// of a personal link who have not answered yet.
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
    .selectFrom("participant_response")
    .innerJoin("time_slot", "time_slot.id", "participant_response.slot_id")
    .select(["time_slot.id", "time_slot.start_time", "time_slot.end_time"])
    .where("participant_response.participant_id", "=", participantId)
    .where("participant_response.status", "=", "yes")
    .orderBy("time_slot.start_time")
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
    available: rows.map((row) => ({ id: row.id, ...rowToRange(row) })),
  };
}

export type SlotResponse = { participantId: string; name: string; available: boolean };

export type ResponseOverview = {
  appointmentId: string;
  aktenzeichen: string;
  // The judge who created the appointment.
  judgeEmail: string;
  // The SEQUENCE for the calendar file that goes with this state.
  calendarSequence: number;
  // Every proposed window with the answers given for it. Windows a participant could no longer see
  // when answering have no answer from that participant.
  slots: Array<AppointmentSlot & { responses: SlotResponse[] }>;
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

  const slots = await db
    .selectFrom("time_slot")
    .select(["id", "start_time", "end_time"])
    .where("appointment_id", "=", appointmentId)
    .orderBy("start_time")
    .execute();

  const responses = await db
    .selectFrom("participant_response")
    .innerJoin("participant", "participant.id", "participant_response.participant_id")
    .select([
      "participant_response.slot_id",
      "participant_response.status",
      "participant.id as participantId",
      participantName,
    ])
    .where("participant.appointment_id", "=", appointmentId)
    .orderBy("participant.created_at")
    .orderBy("participant.id")
    .execute();

  return {
    appointmentId: appointment.id,
    aktenzeichen: appointment.aktenzeichen,
    judgeEmail: appointment.email,
    calendarSequence,
    slots: slots.map((slot) => ({
      id: slot.id,
      ...rowToRange(slot),
      responses: responses
        .filter(({ slot_id }) => slot_id === slot.id)
        .map(({ participantId, name, status }) => ({
          participantId,
          name,
          available: status === "yes",
        })),
    })),
  };
}
