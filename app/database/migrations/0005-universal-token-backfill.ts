import { type Kysely, sql } from "kysely";

// The universal survey link is built from appointment.universal_token, which is set when an
// appointment is published. Appointments published before that get a token here; old links that
// used the appointment id stop working.
export async function up(db: Kysely<any>): Promise<void> {
  await db
    .updateTable("appointment")
    .set({ universal_token: sql`gen_random_uuid()::text` })
    .where("universal_token", "is", null)
    .where("status", "<>", "draft")
    .execute();
}

// The tokens stay: nothing can tell them apart from tokens set by publishing.
export async function down(): Promise<void> {}
