import { sql, type Kysely } from "kysely";

// The calendar feed URL carries this token instead of the user ID, so the address is a secret that
// reveals nothing else. The default fills the column for existing users and for every user created
// later, however it is created: by administrators, by self sign-up or by script.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable("user")
    .addColumn("calendar_token", "uuid", (col) =>
      col
        .notNull()
        .unique()
        .defaultTo(sql`gen_random_uuid()`),
    )
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("user").dropColumn("calendar_token").execute();
}
