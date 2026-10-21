import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Create 'appointment' Table - which has a list of proposed time_slot associated with it.
  await db.schema
    .createTable("appointment")
    .addColumn("id", "text", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()::text`))
    .addColumn("user_id", "text", (col) =>
      // refers to the user who created the appointment
      col.notNull().references("user.id").onDelete("cascade"),
    )
    .addColumn("aktenzeichen", "text", (col) => col.notNull())
    .addColumn("status", "text", (col) => col.notNull().defaultTo("open")) // see AppointmentStatus in types.ts
    .addColumn("universal_token", "text", (col) => col.unique()) // used for generating "anonymous" links to the appointment
    .addColumn("confirmed_slot_id", "text") // Foreign key added after time_slot table exists
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  // Index so we can quickly look up appointments by user_id
  await db.schema.createIndex("idx_appointment_user").on("appointment").column("user_id").execute();

  // 2. Create 'time_slot' Table
  await db.schema
    .createTable("time_slot")
    .addColumn("id", "text", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()::text`))
    .addColumn("appointment_id", "text", (col) =>
      col.notNull().references("appointment.id").onDelete("cascade"),
    )
    .addColumn("start_time", "timestamptz", (col) => col.notNull())
    .addColumn("end_time", "timestamptz") // end_time is deliberately nullable to allow open-ended time slots
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .addCheckConstraint("chk_time_slot_duration", sql`end_time IS NULL OR end_time > start_time`)
    .execute();

  // 3. Add Foreign Key for confirmed_slot_id on 'appointment'
  await db.schema
    .alterTable("appointment")
    .addForeignKeyConstraint("fk_confirmed_slot", ["confirmed_slot_id"], "time_slot", ["id"])
    .onDelete("set null")
    .execute();

  // 4. Create 'participant' Table
  // The judge does not count as a participant, but all other attendees of the appointment do. (Lawyers etc.)
  // Participants are scoped per appointment: if the same person attends multiple appointments, they will have separate participant entries: one for each appointment.
  await db.schema
    .createTable("participant")
    .addColumn("id", "text", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()::text`))
    .addColumn("appointment_id", "text", (col) =>
      col.notNull().references("appointment.id").onDelete("cascade"),
    )
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("type", "text", (col) =>
      // related to universal/anonymous invite links vs. a personal invite link per participant.
      // Product is still deciding which approach to support, so we implement both for now
      // and will simplify (e.g. drop columns) once that is settled.
      // "individual": each participant has a unique link, "universal": all participants share the same link.
      col.notNull().defaultTo("individual"),
    )
    .addColumn("token", "text", (col) => col.unique())
    .addColumn("last_accessed_at", "timestamptz")
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  // 5. Create 'participant_response' Table
  // Each participant has a list of participant_response - one per time_slot they respond to.
  await db.schema
    .createTable("participant_response")
    .addColumn("id", "text", (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()::text`))
    .addColumn("participant_id", "text", (col) =>
      col.notNull().references("participant.id").onDelete("cascade"),
    )
    .addColumn("slot_id", "text", (col) =>
      col.notNull().references("time_slot.id").onDelete("cascade"),
    )
    .addColumn("status", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn("updated_at", "timestamptz", (col) => col.notNull().defaultTo(sql`NOW()`))
    .addUniqueConstraint("uq_participant_slot", ["participant_id", "slot_id"])
    .execute();

  // 6. Create Indexes
  await db.schema
    .createIndex("idx_appointment_universal_token")
    .on("appointment")
    .column("universal_token")
    .where("universal_token", "is not", null)
    .execute();

  await db.schema
    .createIndex("idx_participant_token")
    .on("participant")
    .column("token")
    .where("token", "is not", null)
    .execute();

  await db.schema
    .createIndex("idx_time_slot_appointment")
    .on("time_slot")
    .column("appointment_id")
    .execute();

  await db.schema
    .createIndex("idx_participant_appointment")
    .on("participant")
    .column("appointment_id")
    .execute();

  await db.schema
    .createIndex("idx_response_slot")
    .on("participant_response")
    .column("slot_id")
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  // Drop indexes
  await db.schema.dropIndex("idx_response_slot").execute();
  await db.schema.dropIndex("idx_participant_appointment").execute();
  await db.schema.dropIndex("idx_time_slot_appointment").execute();
  await db.schema.dropIndex("idx_participant_token").execute();
  await db.schema.dropIndex("idx_appointment_user").execute();
  await db.schema.dropIndex("idx_appointment_universal_token").execute();

  // Drop tables in reverse order of foreign key dependencies
  await db.schema.dropTable("participant_response").execute();
  await db.schema.dropTable("participant").execute();

  // Remove foreign key on appointment before dropping time_slot
  await db.schema.alterTable("appointment").dropConstraint("fk_confirmed_slot").execute();

  await db.schema.dropTable("time_slot").execute();
  await db.schema.dropTable("appointment").execute();
}
