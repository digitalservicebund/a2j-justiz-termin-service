import { sql, type Kysely } from "kysely";

// Courts are stored as their code in the XJustiz code list GDS.Gerichte; the app looks up the name.
//
// - richter: data that only judges have, one row per judge, written the first time it is needed.
//   A missing row means the judge has not set anything yet.
// - appointment.court_code: the court the Terminumfrage belongs to. Terminumfragen created before
//   courts existed have none.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("richter")
    .addColumn("user_id", "text", (col) =>
      col.primaryKey().references("user.id").onDelete("cascade"),
    )
    // The court the judge normally works at. New Terminumfragen start with it.
    .addColumn("default_court_code", "text")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  await db.schema.alterTable("appointment").addColumn("court_code", "text").execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable("appointment").dropColumn("court_code").execute();
  await db.schema.dropTable("richter").execute();
}
