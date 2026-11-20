import { sql, type Kysely } from "kysely";

// A person can also be reached by SAFE-ID, the identity in the electronic legal mailboxes (beA, beBPo,
// eBO and so on), in addition to an e-mail address or instead of one. A row still has to say who it
// is: with a name, an address or a SAFE-ID. Several people may share a SAFE-ID, as they may share an
// address, so it is not unique.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("participant").addColumn("safe_id", "text").execute();
  await db.schema
    .alterTable("participant")
    .dropConstraint("chk_participant_has_name_or_email")
    .execute();
  await db.schema
    .alterTable("participant")
    .addCheckConstraint(
      "chk_participant_has_name_email_or_safe_id",
      sql`name IS NOT NULL OR email IS NOT NULL OR safe_id IS NOT NULL`,
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("participant")
    .dropConstraint("chk_participant_has_name_email_or_safe_id")
    .execute();
  // Rows that only have a SAFE-ID get it as their name, so the earlier constraint holds again.
  await sql`UPDATE participant SET name = safe_id WHERE name IS NULL AND email IS NULL`.execute(db);
  await db.schema
    .alterTable("participant")
    .addCheckConstraint(
      "chk_participant_has_name_or_email",
      sql`name IS NOT NULL OR email IS NOT NULL`,
    )
    .execute();
  await db.schema.alterTable("participant").dropColumn("safe_id").execute();
}
