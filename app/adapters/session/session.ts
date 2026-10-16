import { redirect } from "react-router";

import { AuthUserSchema, hasRole, type AuthUser, type UserRole } from "~/core/domain/user";
import { getDb } from "~/database/database";
import { getAuth } from "~/lib/auth.server";

export async function getSessionUser(request: Request): Promise<AuthUser | null> {
  const session = await getAuth().api.getSession({ headers: request.headers });
  if (!session) return null;
  const user = await getDb()
    .selectFrom("user")
    .select(["id", "name", "email", "roles"])
    .where("id", "=", session.user.id)
    .executeTakeFirst();
  return user ? AuthUserSchema.parse(user) : null;
}

export async function requireUser(request: Request): Promise<AuthUser> {
  const user = await getSessionUser(request);
  if (!user) throw redirect("/");
  return user;
}

export async function requireRole(request: Request, role: UserRole): Promise<AuthUser> {
  const user = await requireUser(request);
  if (!hasRole(user, role)) throw new Response("Forbidden", { status: 403 });
  return user;
}

export async function requireAdmin(request: Request): Promise<AuthUser> {
  const user = await requireUser(request);
  if (!user.roles.includes("admin")) throw new Response("Forbidden", { status: 403 });
  return user;
}
