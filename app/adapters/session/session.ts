import { createCookieSessionStorage, redirect } from "react-router";
import type { AuthService, AuthUser, UserRole } from "~/core/domain/user";

const { getSession, commitSession, destroySession } = createCookieSessionStorage<{
  userId: string;
}>({
  cookie: {
    name: "__session",
    secrets: ["dev-secret"],
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  },
});

export { getSession, commitSession, destroySession };

export async function getSessionUser(
  request: Request,
  authService: AuthService,
): Promise<AuthUser | null> {
  const session = await getSession(request.headers.get("Cookie"));
  const userId = session.get("userId");
  if (!userId) return null;
  return authService.getUserById(userId);
}

export async function requireUser(
  request: Request,
  authService: AuthService,
): Promise<AuthUser> {
  const user = await getSessionUser(request, authService);
  if (!user) throw redirect("/");
  return user;
}

export async function requireRole(
  request: Request,
  authService: AuthService,
  role: UserRole,
): Promise<AuthUser> {
  const user = await requireUser(request, authService);
  if (user.role !== role) throw redirect("/");
  return user;
}
