import { redirect } from "react-router";
import { authService } from "~/bootstrap";
import type { UserRole } from "~/core/domain/user";
import { commitSession, getSession } from "~/adapters/session/session";

export async function loader() {
  return redirect("/");
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const role = formData.get("role") as UserRole | null;
  if (!role) return null;
  const user = authService.getUserByRole(role);
  if (!user) return null;
  const session = await getSession(request.headers.get("Cookie"));
  session.set("userId", user.id);
  return redirect("/", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export default function LoginRoute() {
  return null;
}
