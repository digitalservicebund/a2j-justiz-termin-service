import type { Kysely } from "kysely";

// Calendar apps replace an event only when its SEQUENCE is higher than that of the copy they hold.
// The counter lives here, not in the mails, so every calendar file for an appointment, whatever
// triggered it, continues from the last one. Mails sent before this column existed carried 0.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("appointment")
    .addColumn("calendar_sequence", "integer", (col) => col.notNull().defaultTo(0))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("appointment").dropColumn("calendar_sequence").execute();
}
