import { redirect } from "react-router";
import { commitSession, getSession } from "~/adapters/session/session";
import { authService } from "~/bootstrap";
import { UserRoleSchema } from "~/core/domain/user";

export async function loader() {
  return redirect("/");
}

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const roleResult = UserRoleSchema.safeParse(formData.get("role"));
  if (!roleResult.success) return null;
  const user = authService.getUserByRole(roleResult.data);
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
