import { redirect } from "react-router";
import { authService } from "@/bootstrap";
import { requireUser } from "@/infrastructure/session/session";
import type { Role } from "@/domain/verfahren";

const roleRedirectLinks: Record<Role, string> = {
  RICHTER: '/richter',
  KLAEGER: '/klaeger',
  BEKLAGTER: '/beklagter',
}

export async function loader({ request }: { request: Request }) {
  const user = await requireUser(request, authService);
  return redirect(roleRedirectLinks[user.role]);
}

export default function Home() {
  return null;
}
