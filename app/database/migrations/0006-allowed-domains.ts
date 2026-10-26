import { type Kysely, sql } from "kysely";

// Addresses on these domains may sign in without being provisioned first.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("allowed_domain")
    .addColumn("domain", "text", (col) => col.primaryKey())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("allowed_domain").execute();
}
