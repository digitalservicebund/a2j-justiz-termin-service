import { randomBytes } from "node:crypto";

import { sql, type Kysely } from "kysely";

import { confirmedWindow, rowToRange, type TimeRange } from "../../core/domain/time/time-range.ts";
import type { AppointmentStatus, Database } from "../../database/types.ts";
import { logInfo } from "../../lib/logging.ts";

// A stored time slot. Its id stays the same as long as the slot is not replaced.
export type AppointmentSlot = TimeRange & { id: string };

export type Appointment = {
  id: string;
  aktenzeichen: string;
  slots: AppointmentSlot[];
  status: AppointmentStatus;
  // The secret of the universal survey link. Drafts have none; it is set when they are published.
  universalToken?: string | null;
  // The chosen window, once the appointment is confirmed. It lies within one of the slots.
  confirmedSlot?: TimeRange | null;
};

// A draft starts with just the Aktenzeichen. Its time slots are added one at a time, and it is
// published once the judge confirms the review.
export async function createDraftAppointment(
  db: Kysely<Database>,
  userId: string,
  aktenzeichen: string,
): Promise<string> {
  const { id } = await db
    .insertInto("appointment")
    .values({ user_id: userId, aktenzeichen, status: "draft" })
    .returning("id")
    .executeTakeFirstOrThrow();
  logInfo(`User ${userId} created draft appointment ${id}`);
  return id;
}

// Only the user's own drafts can be changed; a time slot is a draft exactly when its appointment is.
const ownDraft = (db: Kysely<Database>, userId: string, id: string) =>
  db
    .selectFrom("appointment")
    .select("id")
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .where("status", "=", "draft");

// Returns false when the user has no such draft.
export async function updateDraftAktenzeichen(
  db: Kysely<Database>,
  userId: string,
  id: string,
  aktenzeichen: string,
): Promise<boolean> {
  const updated = await db
    .updateTable("appointment")
    .set({ aktenzeichen, updated_at: new Date() })
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .where("status", "=", "draft")
    .returning("id")
    .executeTakeFirst();
  return Boolean(updated);
}

// Returns false when the user has no such draft.
export async function addDraftSlot(
  db: Kysely<Database>,
  userId: string,
  id: string,
  { start, end }: TimeRange,
): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
    if (!(await ownDraft(trx, userId, id).executeTakeFirst())) return false;
    await trx
      .insertInto("time_slot")
      .values({ appointment_id: id, start_time: start, end_time: end })
      .execute();
    await trx
      .updateTable("appointment")
      .set({ updated_at: new Date() })
      .where("id", "=", id)
      .execute();
    return true;
  });
}

// Returns false when the user has no such draft or the draft has no such slot.
export async function updateDraftSlot(
  db: Kysely<Database>,
  userId: string,
  id: string,
  slotId: string,
  { start, end }: TimeRange,
): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
    if (!(await ownDraft(trx, userId, id).executeTakeFirst())) return false;
    const updated = await trx
      .updateTable("time_slot")
      .set({ start_time: start, end_time: end })
      .where("id", "=", slotId)
      .where("appointment_id", "=", id)
      .returning("id")
      .executeTakeFirst();
    if (!updated) return false;
    await trx
      .updateTable("appointment")
      .set({ updated_at: new Date() })
      .where("id", "=", id)
      .execute();
    return true;
  });
}

// Returns false when the user has no such draft or the draft has no such slot.
export async function deleteDraftSlot(
  db: Kysely<Database>,
  userId: string,
  id: string,
  slotId: string,
): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
    if (!(await ownDraft(trx, userId, id).executeTakeFirst())) return false;
    const deleted = await trx
      .deleteFrom("time_slot")
      .where("id", "=", slotId)
      .where("appointment_id", "=", id)
      .returning("id")
      .executeTakeFirst();
    if (!deleted) return false;
    await trx
      .updateTable("appointment")
      .set({ updated_at: new Date() })
      .where("id", "=", id)
      .execute();
    return true;
  });
}

// Removes a draft that nothing was entered into, so that giving up leaves no empty entry in the
// overview. A draft with an Aktenzeichen, a time slot or a person is kept. Returns whether a draft
// was removed.
export async function deleteDraftIfEmpty(
  db: Kysely<Database>,
  userId: string,
  id: string,
): Promise<boolean> {
  const deleted = await db
    .deleteFrom("appointment")
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .where("status", "=", "draft")
    .where(sql<boolean>`btrim(aktenzeichen) = ''`)
    .where((eb) =>
      eb.not(
        eb.exists(
          eb.selectFrom("time_slot").select("id").whereRef("appointment_id", "=", "appointment.id"),
        ),
      ),
    )
    .where((eb) =>
      eb.not(
        eb.exists(
          eb
            .selectFrom("participant")
            .select("id")
            .whereRef("appointment_id", "=", "appointment.id"),
        ),
      ),
    )
    .returning("id")
    .executeTakeFirst();
  return Boolean(deleted);
}

// Returns undefined for unknown appointments and for those of other users.
export async function getAppointment(
  db: Kysely<Database>,
  userId: string,
  id: string,
): Promise<Appointment | undefined> {
  const appointment = await db
    .selectFrom("appointment")
    .select([
      "id",
      "aktenzeichen",
      "status",
      "universal_token",
      "confirmed_start_time",
      "confirmed_end_time",
    ])
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  if (!appointment) return undefined;

  const slots = await db
    .selectFrom("time_slot")
    .select(["id", "start_time", "end_time"])
    .where("appointment_id", "=", id)
    .orderBy("start_time")
    .execute();

  return {
    id: appointment.id,
    aktenzeichen: appointment.aktenzeichen,
    status: appointment.status,
    universalToken: appointment.universal_token,
    slots: slots.map((slot) => ({ id: slot.id, ...rowToRange(slot) })),
    confirmedSlot: confirmedWindow(appointment),
  };
}

// Confirms the window, which has to lie within one of the proposed slots, for an open appointment.
// Returns false when the user has no such open appointment or no slot contains the window.
export async function confirmAppointment(
  db: Kysely<Database>,
  userId: string,
  id: string,
  { start, end }: TimeRange,
): Promise<boolean> {
  const confirmed = await db.transaction().execute(async (trx) => {
    const slot = await trx
      .selectFrom("time_slot")
      .innerJoin("appointment", "appointment.id", "time_slot.appointment_id")
      .select("time_slot.id")
      .where("appointment.id", "=", id)
      .where("appointment.user_id", "=", userId)
      .where("appointment.status", "=", "open")
      .where("time_slot.start_time", "<=", start)
      .where("time_slot.end_time", ">=", end)
      .executeTakeFirst();
    if (!slot) return false;

    const updated = await trx
      .updateTable("appointment")
      .set({
        status: "confirmed",
        confirmed_slot_id: slot.id,
        confirmed_start_time: start,
        confirmed_end_time: end,
        updated_at: new Date(),
      })
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .where("status", "=", "open")
      .returning("id")
      .executeTakeFirst();
    return Boolean(updated);
  });
  if (confirmed) logInfo(`User ${userId} confirmed appointment ${id}`);
  return confirmed;
}

// Publishing also issues the token of the universal survey link.
// Returns false when the user has no draft with this id.
export async function publishAppointment(
  db: Kysely<Database>,
  userId: string,
  id: string,
): Promise<boolean> {
  const published = await db
    .updateTable("appointment")
    .set({
      status: "open",
      universal_token: randomBytes(24).toString("base64url"),
      updated_at: new Date(),
    })
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .where("status", "=", "draft")
    .returning("id")
    .executeTakeFirst();
  if (published) logInfo(`User ${userId} published appointment ${id}`);
  return Boolean(published);
}

// Takes the SEQUENCE for the next calendar file of the appointment. One statement raises and reads
// the counter, so concurrent mails never share a number; the row stays locked until the surrounding
// transaction ends. Returns undefined for an unknown appointment.
export async function nextCalendarSequence(
  db: Kysely<Database>,
  id: string,
): Promise<number | undefined> {
  const row = await db
    .updateTable("appointment")
    .set((eb) => ({ calendar_sequence: eb("calendar_sequence", "+", 1) }))
    .where("id", "=", id)
    .returning("calendar_sequence")
    .executeTakeFirst();
  return row?.calendar_sequence;
}

export type AppointmentSummary = {
  id: string;
  aktenzeichen: string;
  status: AppointmentStatus;
  // The chosen window, once the appointment is confirmed.
  confirmedSlot: TimeRange | null;
};

// The user's own appointments, newest first.
export async function listAppointments(
  db: Kysely<Database>,
  userId: string,
): Promise<AppointmentSummary[]> {
  const rows = await db
    .selectFrom("appointment")
    .select([
      "appointment.id",
      "appointment.aktenzeichen",
      "appointment.status",
      "appointment.confirmed_start_time",
      "appointment.confirmed_end_time",
    ])
    .where("appointment.user_id", "=", userId)
    .orderBy("appointment.created_at", "desc")
    .orderBy("appointment.id")
    .execute();

  return rows.map(({ confirmed_start_time, confirmed_end_time, ...appointment }) => ({
    ...appointment,
    confirmedSlot: confirmedWindow({ confirmed_start_time, confirmed_end_time }),
  }));
}
