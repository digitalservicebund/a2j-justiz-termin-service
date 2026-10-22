import type { Kysely } from "kysely";

import type { AppointmentStatus, Database } from "../../database/types.ts";
import { logInfo } from "../../lib/logging.ts";

export type TimeRange = { start: Date; end: Date };

export type AppointmentDraft = { aktenzeichen: string; slots: TimeRange[] };

export type Appointment = AppointmentDraft & {
  id: string;
  status: AppointmentStatus;
  // The chosen time slot, once the appointment is confirmed. It is one of the slots.
  confirmedSlot?: TimeRange | null;
};

function insertSlots(db: Kysely<Database>, appointmentId: string, slots: TimeRange[]) {
  return db
    .insertInto("time_slot")
    .values(
      slots.map(({ start, end }) => ({
        appointment_id: appointmentId,
        start_time: start,
        end_time: end,
      })),
    )
    .execute();
}

// Appointments start as drafts; they are published once the judge confirms the review.
export async function createDraftAppointment(
  db: Kysely<Database>,
  userId: string,
  { aktenzeichen, slots }: AppointmentDraft,
): Promise<string> {
  const id = await db.transaction().execute(async (trx) => {
    const { id } = await trx
      .insertInto("appointment")
      .values({ user_id: userId, aktenzeichen, status: "draft" })
      .returning("id")
      .executeTakeFirstOrThrow();
    await insertSlots(trx, id, slots);
    return id;
  });
  logInfo(`User ${userId} created draft appointment ${id}`);
  return id;
}

// Replaces the Aktenzeichen and all time slots of a draft. Returns false when the user has no such draft.
export async function updateDraftAppointment(
  db: Kysely<Database>,
  userId: string,
  id: string,
  { aktenzeichen, slots }: AppointmentDraft,
): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
    const updated = await trx
      .updateTable("appointment")
      .set({ aktenzeichen, updated_at: new Date() })
      .where("id", "=", id)
      .where("user_id", "=", userId)
      .where("status", "=", "draft")
      .returning("id")
      .executeTakeFirst();
    if (!updated) return false;
    await trx.deleteFrom("time_slot").where("appointment_id", "=", id).execute();
    await insertSlots(trx, id, slots);
    return true;
  });
}

// Returns undefined for unknown appointments and for those of other users.
export async function getAppointment(
  db: Kysely<Database>,
  userId: string,
  id: string,
): Promise<Appointment | undefined> {
  const appointment = await db
    .selectFrom("appointment")
    .select(["id", "aktenzeichen", "status", "confirmed_slot_id"])
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

  // end_time is nullable in the schema, but the form always sets it.
  const toRange = ({ start_time, end_time }: (typeof slots)[number]): TimeRange => ({
    start: new Date(start_time),
    end: new Date(end_time ?? start_time),
  });
  const confirmed = slots.find(({ id: slotId }) => slotId === appointment.confirmed_slot_id);

  return {
    id: appointment.id,
    aktenzeichen: appointment.aktenzeichen,
    status: appointment.status,
    slots: slots.map(toRange),
    confirmedSlot: confirmed ? toRange(confirmed) : null,
  };
}

// Returns false when the user has no draft with this id.
export async function publishAppointment(
  db: Kysely<Database>,
  userId: string,
  id: string,
): Promise<boolean> {
  const published = await db
    .updateTable("appointment")
    .set({ status: "open", updated_at: new Date() })
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .where("status", "=", "draft")
    .returning("id")
    .executeTakeFirst();
  if (published) logInfo(`User ${userId} published appointment ${id}`);
  return Boolean(published);
}

export type AppointmentSummary = {
  id: string;
  aktenzeichen: string;
  status: AppointmentStatus;
  // The chosen time slot, once the appointment is confirmed.
  confirmedSlot: TimeRange | null;
};

// The user's own appointments, newest first.
export async function listAppointments(
  db: Kysely<Database>,
  userId: string,
): Promise<AppointmentSummary[]> {
  const rows = await db
    .selectFrom("appointment")
    .leftJoin("time_slot", "time_slot.id", "appointment.confirmed_slot_id")
    .select([
      "appointment.id",
      "appointment.aktenzeichen",
      "appointment.status",
      "time_slot.start_time",
      "time_slot.end_time",
    ])
    .where("appointment.user_id", "=", userId)
    .orderBy("appointment.created_at", "desc")
    .orderBy("appointment.id")
    .execute();

  return rows.map(({ start_time, end_time, ...appointment }) => ({
    ...appointment,
    confirmedSlot: start_time
      ? { start: new Date(start_time), end: new Date(end_time ?? start_time) }
      : null,
  }));
}
