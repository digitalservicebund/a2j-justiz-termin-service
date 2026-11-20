import { sql, type Kysely } from "kysely";

// The judge invites each person of a published Terminumfrage to the survey: by e-mail, through the
// electronic legal transport (ERV) to the SAFE-ID, or outside the app, which the judge records by
// hand. Every invitation is kept, so a person who was invited again shows the latest one.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("participant_invitation")
    .addColumn("id", "text", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()::text`))
    .addColumn("participant_id", "text", (col) =>
      col.notNull().references("participant.id").onDelete("cascade"),
    )
    .addColumn("channel", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .addCheckConstraint(
      "chk_participant_invitation_channel",
      sql`channel IN ('email', 'erv', 'manual')`,
    )
    .execute();

  await db.schema
    .createIndex("idx_participant_invitation_participant")
    .on("participant_invitation")
    .columns(["participant_id", "created_at"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("idx_participant_invitation_participant").execute();
  await db.schema.dropTable("participant_invitation").execute();
}
