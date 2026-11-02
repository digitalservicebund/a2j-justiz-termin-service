import { sql, type Kysely } from "kysely";

// Appointments confirmed before the confirmed window existed only have a slot. They get the whole
// slot as their window, and from now on a confirmed appointment always has slot and window, so the
// code reading them needs no fallback.
export async function up(db: Kysely<any>): Promise<void> {
  await sql`
    UPDATE appointment
    SET confirmed_start_time = time_slot.start_time,
        confirmed_end_time = COALESCE(time_slot.end_time, time_slot.start_time)
    FROM time_slot
    WHERE time_slot.id = appointment.confirmed_slot_id
      AND appointment.status = 'confirmed'
      AND (appointment.confirmed_start_time IS NULL OR appointment.confirmed_end_time IS NULL)
  `.execute(db);

  await db.schema
    .alterTable("appointment")
    .addCheckConstraint(
      "chk_confirmed_has_window",
      sql`status <> 'confirmed' OR (confirmed_slot_id IS NOT NULL AND confirmed_start_time IS NOT NULL AND confirmed_end_time IS NOT NULL AND confirmed_end_time >= confirmed_start_time)`,
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("appointment").dropConstraint("chk_confirmed_has_window").execute();
}
