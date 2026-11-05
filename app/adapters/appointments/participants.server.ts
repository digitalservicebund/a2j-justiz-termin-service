import { randomBytes } from "node:crypto";

import { sql, type Kysely } from "kysely";

import type { Database } from "../../database/types.ts";
import { logInfo } from "../../lib/logging.ts";

// What a person is called wherever the app shows one: the name, or the address of a person who has
// no name. Select it as `name`. The row always has one of them.
export const participantName = sql<string>`COALESCE(participant.name, participant.email)`.as(
  "name",
);

// A person has an e-mail address, a name or both; the form needs one of them.
export type ParticipantInput = { email: string | null; name: string | null };

export type DraftParticipant = ParticipantInput & { id: string };

// Only the user's own drafts can be changed.
const ownDraft = (db: Kysely<Database>, userId: string, id: string) =>
  db
    .selectFrom("appointment")
    .select("id")
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .where("status", "=", "draft");

const touch = (db: Kysely<Database>, id: string) =>
  db.updateTable("appointment").set({ updated_at: new Date() }).where("id", "=", id).execute();

// The people of the user's own appointment in the order they were added. Several can share an
// address or a name. Empty for an appointment that is not the user's.
export async function listParticipants(
  db: Kysely<Database>,
  userId: string,
  appointmentId: string,
): Promise<DraftParticipant[]> {
  return db
    .selectFrom("participant")
    .innerJoin("appointment", "appointment.id", "participant.appointment_id")
    .select(["participant.id", "participant.email", "participant.name"])
    .where("appointment.id", "=", appointmentId)
    .where("appointment.user_id", "=", userId)
    .orderBy("participant.created_at")
    .orderBy("participant.id")
    .execute();
}

// Every listed person gets a personal link, so the token is issued here. Nothing is sent to them.
// Returns false when the user has no such draft.
export async function addDraftParticipant(
  db: Kysely<Database>,
  userId: string,
  id: string,
  { email, name }: ParticipantInput,
): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
    if (!(await ownDraft(trx, userId, id).executeTakeFirst())) return false;
    await trx
      .insertInto("participant")
      .values({
        appointment_id: id,
        email,
        name,
        type: "individual",
        token: randomBytes(24).toString("base64url"),
      })
      .execute();
    await touch(trx, id);
    return true;
  });
}

// Returns false when the user has no such draft or the draft has no such person.
export async function updateDraftParticipant(
  db: Kysely<Database>,
  userId: string,
  id: string,
  participantId: string,
  { email, name }: ParticipantInput,
): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
    if (!(await ownDraft(trx, userId, id).executeTakeFirst())) return false;
    const updated = await trx
      .updateTable("participant")
      .set({ email, name, updated_at: new Date() })
      .where("id", "=", participantId)
      .where("appointment_id", "=", id)
      .returning("id")
      .executeTakeFirst();
    if (!updated) return false;
    await touch(trx, id);
    return true;
  });
}

// Returns false when the user has no such draft or the draft has no such person.
export async function deleteDraftParticipant(
  db: Kysely<Database>,
  userId: string,
  id: string,
  participantId: string,
): Promise<boolean> {
  const deleted = await db.transaction().execute(async (trx) => {
    if (!(await ownDraft(trx, userId, id).executeTakeFirst())) return false;
    const removed = await trx
      .deleteFrom("participant")
      .where("id", "=", participantId)
      .where("appointment_id", "=", id)
      .returning("id")
      .executeTakeFirst();
    if (!removed) return false;
    await touch(trx, id);
    return true;
  });
  if (deleted) logInfo(`User ${userId} removed participant ${participantId} from draft ${id}`);
  return deleted;
}
