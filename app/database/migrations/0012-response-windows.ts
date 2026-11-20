import { sql, type Kysely } from "kysely";

// When a participant is available within a slot: one or more availability windows per "yes"
// response. A participant who is available for all of what was offered has one window that covers
// it; a "no" response has none. Earlier "yes" responses applied to the whole slot.
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("participant_response_window")
    .addColumn("id", "text", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()::text`))
    .addColumn("response_id", "text", (col) =>
      col.notNull().references("participant_response.id").onDelete("cascade"),
    )
    .addColumn("start_time", "timestamptz", (col) => col.notNull())
    .addColumn("end_time", "timestamptz", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .addCheckConstraint("chk_response_window_duration", sql`end_time > start_time`)
    .execute();

  await db.schema
    .createIndex("idx_response_window_response")
    .on("participant_response_window")
    .column("response_id")
    .execute();

  // A slot without an end has no length, so nobody can be available in it.
  await sql`
    INSERT INTO participant_response_window (response_id, start_time, end_time)
    SELECT participant_response.id, time_slot.start_time, time_slot.end_time
    FROM participant_response
    JOIN time_slot ON time_slot.id = participant_response.slot_id
    WHERE participant_response.status = 'yes'
      AND time_slot.end_time > time_slot.start_time
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex("idx_response_window_response").execute();
  await db.schema.dropTable("participant_response_window").execute();
}
