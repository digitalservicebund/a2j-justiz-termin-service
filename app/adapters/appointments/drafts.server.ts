import type { Kysely } from "kysely";

import type { Database } from "../../database/types.ts";

// Only the user's own drafts can be changed; its time slots and people are drafts exactly when
// the appointment is. Run it in the transaction that makes the change.
export const ownDraft = (db: Kysely<Database>, userId: string, id: string) =>
  db
    .selectFrom("appointment")
    .select("id")
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .where("status", "=", "draft");

// Marks the appointment as changed after a change to its time slots or people.
export const touch = (db: Kysely<Database>, id: string) =>
  db.updateTable("appointment").set({ updated_at: new Date() }).where("id", "=", id).execute();
