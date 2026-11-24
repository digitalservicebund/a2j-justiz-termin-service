import { randomBytes } from "node:crypto";

import { sql, type Kysely } from "kysely";

import type { Database } from "../../database/types.ts";
import { logInfo } from "../../lib/infra/logging.ts";
import { ownDraft, touch } from "./drafts.server.ts";

// What a person is called wherever the app shows one: the name, else the e-mail address, else the
// SAFE-ID. Select it as `name`. The row always has one of them.
export const participantName =
  sql<string>`COALESCE(participant.name, participant.email, participant.safe_id)`.as("name");

// A person has an e-mail address, a SAFE-ID, a name or several of them; the form needs one.
export type ParticipantInput = { email: string | null; safeId: string | null; name: string | null };

export type DraftParticipant = ParticipantInput & { id: string };

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
    .select([
      "participant.id",
      "participant.email",
      "participant.safe_id as safeId",
      "participant.name",
    ])
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
  { email, safeId, name }: ParticipantInput,
): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
    if (!(await ownDraft(trx, userId, id).executeTakeFirst())) return false;
    await trx
      .insertInto("participant")
      .values({
        appointment_id: id,
        email,
        safe_id: safeId,
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
  { email, safeId, name }: ParticipantInput,
): Promise<boolean> {
  return db.transaction().execute(async (trx) => {
    if (!(await ownDraft(trx, userId, id).executeTakeFirst())) return false;
    const updated = await trx
      .updateTable("participant")
      .set({ email, safe_id: safeId, name, updated_at: new Date() })
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
