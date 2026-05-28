import { redirect } from "react-router";
import { getSessionUser } from "~/adapters/session/session";
import { authService } from "~/bootstrap";
import { Shell } from "~/components/shared/SchedulingShared";
import type { Role } from "~/core/domain/verfahren";

const roleRedirectLinks: Record<Role, string> = {
  RICHTER: "/richter",
  KLAEGER: "/klaeger",
  BEKLAGTER: "/beklagter",
};

export async function loader({ request }: { request: Request }) {
  const user = await getSessionUser(request, authService);
  if (user) return redirect(roleRedirectLinks[user.role]);
  return {};
}

export default function Home() {
  return (
    <Shell title="Court Appointment Scheduling">
      <p className="kern-body text-slate-500">
        Select a role from the dropdown above to continue.
      </p>
    </Shell>
  );
}
