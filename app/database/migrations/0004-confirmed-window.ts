import type { Kysely } from "kysely";

// The judge may confirm a shorter window than the proposed slot, so the confirmed window is stored
// next to the slot it was chosen from. Both stay empty until the appointment is confirmed.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("appointment")
    .addColumn("confirmed_start_time", "timestamptz")
    .addColumn("confirmed_end_time", "timestamptz")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("appointment")
    .dropColumn("confirmed_start_time")
    .dropColumn("confirmed_end_time")
    .execute();
}
