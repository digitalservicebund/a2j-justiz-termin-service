import { sql, type Kysely } from "kysely";

// The judge lists the people of a proceeding by e-mail address, with a name that is optional when
// there is an address. A person without an address needs a name, so that a row always says who it
// is. Several people may share an address (a registry, say) or a name, so nothing here is unique.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("participant").addColumn("email", "text").execute();
  await db.schema
    .alterTable("participant")
    .alterColumn("name", (column) => column.dropNotNull())
    .execute();
  await db.schema
    .alterTable("participant")
    .addCheckConstraint(
      "chk_participant_has_name_or_email",
      sql`name IS NOT NULL OR email IS NOT NULL`,
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("participant")
    .dropConstraint("chk_participant_has_name_or_email")
    .execute();
  // Rows that only have an address get it as their name, so the column can be required again.
  await sql`UPDATE participant SET name = email WHERE name IS NULL`.execute(db);
  await db.schema
    .alterTable("participant")
    .alterColumn("name", (column) => column.setNotNull())
    .execute();
  await db.schema.alterTable("participant").dropColumn("email").execute();
}
