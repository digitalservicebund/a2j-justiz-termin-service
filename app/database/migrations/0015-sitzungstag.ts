import { sql, type Kysely } from "kysely";

// The regular court days of a judge: a weekday from Monday to Friday and the hours of the
// hearings on it. A judge can have several, also on the same weekday. The times have no time zone
// on purpose: they are Berlin wall-clock times that hold all year, and only a concrete date gives
// them an offset.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("sitzungstag")
    .addColumn("id", "text", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()::text`))
    .addColumn("user_id", "text", (col) => col.notNull().references("user.id").onDelete("cascade"))
    // ISO weekday: 1 is Monday, 5 is Friday.
    .addColumn("weekday", "smallint", (col) => col.notNull())
    .addColumn("start_time", "time", (col) => col.notNull())
    .addColumn("end_time", "time", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .addCheckConstraint("chk_sitzungstag_weekday", sql`weekday BETWEEN 1 AND 5`)
    .addCheckConstraint("chk_sitzungstag_duration", sql`end_time > start_time`)
    .execute();

  await sql`COMMENT ON COLUMN sitzungstag.start_time IS 'Berlin wall-clock time'`.execute(db);
  await sql`COMMENT ON COLUMN sitzungstag.end_time IS 'Berlin wall-clock time'`.execute(db);

  await db.schema
    .createIndex("idx_sitzungstag_user")
    .on("sitzungstag")
    .columns(["user_id", "weekday", "start_time"])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("idx_sitzungstag_user").execute();
  await db.schema.dropTable("sitzungstag").execute();
}
