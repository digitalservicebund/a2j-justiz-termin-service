import { Form, redirect, useActionData } from "react-router";
import { authService } from "@/bootstrap";
import type { UserRole } from "@/core/domain/user";
import { commitSession, getSession } from "@/adapters/session/session";
import { InlineError } from "~/components/shared/schedulingShared";

const ROLES: { value: UserRole; label: string }[] = [
  { value: "RICHTER",   label: "Richter"   },
  { value: "KLAEGER",   label: "Klaeger"   },
  { value: "BEKLAGTER", label: "Beklagter" },
];

export async function action({ request }: { request: Request }) {
  const formData = await request.formData();
  const role = formData.get("role") as UserRole | null;

  if (!role) return { error: "Please select a role." };

  const user = authService.getUserByRole(role);
  if (!user) return { error: "Invalid role." };

  const session = await getSession(request.headers.get("Cookie"));
  session.set("userId", user.id);

  return redirect("/", {
    headers: { "Set-Cookie": await commitSession(session) },
  });
}

export function meta() {
  return [{ title: "Login - Court Appointment Scheduling" }];
}

export default function LoginRoute() {
  const actionData = useActionData<typeof action>();

  return (
    <main className="mx-auto max-w-sm px-6 py-16 space-y-8">
      <h1 className="kern-heading-large">Court Appointment Scheduling</h1>
      <Form method="post" className="space-y-4">
        <div className="kern-form-input">
          <label className="kern-label" htmlFor="role">
            Role
          </label>
          <select className="kern-form-input__input" id="role" name="role" required defaultValue="">
            <option value="" disabled>Select a role…</option>
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>
        {actionData?.error && <InlineError message={actionData.error} />}
        <button className="kern-btn kern-btn--primary" type="submit">
          <span className="kern-label">Log in</span>
        </button>
      </Form>
    </main>
  );
}
