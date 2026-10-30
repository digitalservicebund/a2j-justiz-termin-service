import { randomUUID } from "node:crypto";

import { sql, type Kysely } from "kysely";
import { z } from "zod";

import { NewUserSchema } from "../../core/domain/user.ts";
import { getDb } from "../../database/database.ts";
import type { Database } from "../../database/types.ts";
import { logInfo } from "../../lib/logging.ts";
import { isEmailDomainAllowed } from "./allowed-domains.server.ts";

export class UserManagementError extends Error {}

export const UpdateUserSchema = NewUserSchema.omit({ email: true }).extend({
  id: z.string().min(1),
});

export async function insertUser(db: Kysely<Database>, input: z.infer<typeof NewUserSchema>) {
  const user = NewUserSchema.parse(input);
  const result = await db
    .insertInto("user")
    .values({ ...user, id: randomUUID(), emailVerified: false })
    .onConflict((conflict) => conflict.column("email").doNothing())
    .returning(["id", "name", "email", "roles"])
    .executeTakeFirst();
  if (!result) throw new UserManagementError("Diese E‑Mail-Adresse ist bereits hinterlegt.");
  logInfo(`Created user ${result.id}`);
  return result;
}

export async function userExists(db: Kysely<Database>, email: string) {
  const user = await db
    .selectFrom("user")
    .select("id")
    .where("email", "=", email.trim().toLowerCase())
    .executeTakeFirst();
  return user !== undefined;
}

// Provisioned users and addresses on an allowed domain may request a login link.
export async function canSignIn(db: Kysely<Database>, email: string) {
  return (await userExists(db, email)) || isEmailDomainAllowed(db, email.trim().toLowerCase());
}

export function listUsers() {
  return getDb()
    .selectFrom("user")
    .select(["id", "name", "email", "roles"])
    .orderBy("email")
    .execute();
}

export async function updateUser(
  db: Kysely<Database>,
  actorId: string,
  input: z.infer<typeof UpdateUserSchema>,
) {
  const { id, ...changes } = UpdateUserSchema.parse(input);
  if (id === actorId && !changes.roles.includes("admin")) {
    throw new UserManagementError("Sie können Ihre eigenen Administratorrechte nicht entfernen.");
  }
  const result = await db
    .updateTable("user")
    .set({ ...changes, updatedAt: new Date() })
    .where("id", "=", id)
    .returning("id")
    .executeTakeFirst();
  if (!result) throw new UserManagementError("Benutzer nicht gefunden.");
  await db.deleteFrom("session").where("userId", "=", id).execute();
  logInfo(`Administrator ${actorId} updated user ${id}`);
}

export async function deleteUser(db: Kysely<Database>, actorId: string, id: string) {
  if (id === actorId) {
    throw new UserManagementError("Sie können Ihren eigenen Benutzer nicht löschen.");
  }
  const user = await db
    .deleteFrom("user")
    .where("id", "=", id)
    .returning("email")
    .executeTakeFirst();
  if (!user) throw new UserManagementError("Benutzer nicht gefunden.");
  // Pending links belong to an email address, not a user ID. Remove them so
  // re-adding the same address cannot reactivate a previously issued link.
  await db
    .deleteFrom("verification")
    .where("identifier", "like", "magic-link:%")
    .where(sql<string>`lower("value"::jsonb ->> 'email')`, "=", user.email)
    .execute();
  logInfo(`Administrator ${actorId} deleted user ${id}`);
}
