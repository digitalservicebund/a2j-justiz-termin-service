import { sql, type Kysely } from "kysely";

// An ERV invitation is not sent while the judge waits: it is recorded as pending, handed to the
// Basisdienst: ERV Versand, and settled when its reply arrives, at whichever instance receives it.
// The correlation ID ties the reply to the invitation. E-mail and manual invitations are settled at
// once, as are all invitations recorded before.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("participant_invitation")
    .addColumn("status", "text", (col) => col.notNull().defaultTo("sent"))
    .addColumn("correlation_id", "text")
    // Why the ERV did not deliver it, as the problem type of the reply. Null otherwise.
    .addColumn("failure", "text")
    .execute();

  await db.schema
    .alterTable("participant_invitation")
    .addCheckConstraint(
      "chk_participant_invitation_status",
      sql`status IN ('pending', 'sent', 'failed')`,
    )
    .execute();

  await db.schema
    .createIndex("uq_participant_invitation_correlation_id")
    .on("participant_invitation")
    .column("correlation_id")
    .unique()
    .where("correlation_id", "is not", null)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("uq_participant_invitation_correlation_id").execute();
  await db.schema
    .alterTable("participant_invitation")
    .dropConstraint("chk_participant_invitation_status")
    .execute();
  await db.schema
    .alterTable("participant_invitation")
    .dropColumn("failure")
    .dropColumn("correlation_id")
    .dropColumn("status")
    .execute();
}
