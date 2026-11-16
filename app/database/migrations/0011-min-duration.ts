import { sql, type Kysely } from "kysely";

// The shortest a proposed time slot may be, in minutes. The judge enters it with the Aktenzeichen.
// It is empty for drafts that do not have it yet and for appointments created before this column.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("appointment").addColumn("min_duration_minutes", "integer").execute();
  await db.schema
    .alterTable("appointment")
    .addCheckConstraint(
      "chk_appointment_min_duration",
      sql`min_duration_minutes IS NULL OR min_duration_minutes > 0`,
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("appointment")
    .dropConstraint("chk_appointment_min_duration")
    .execute();
  await db.schema.alterTable("appointment").dropColumn("min_duration_minutes").execute();
}
