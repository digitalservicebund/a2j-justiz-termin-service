import { sql, type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("user")
    .addColumn("roles", sql`text[]`, (col) => col.notNull())
    .alterColumn("emailVerified", (col) => col.setDefault(false))
    .execute();
  await db.schema
    .alterTable("user")
    .addCheckConstraint("user_email_normalized", sql`email = lower(trim(email))`)
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema.alterTable("user").dropConstraint("user_email_normalized").execute();
  await db.schema
    .alterTable("user")
    .dropColumn("roles")
    .alterColumn("emailVerified", (col) => col.dropDefault())
    .execute();
}
