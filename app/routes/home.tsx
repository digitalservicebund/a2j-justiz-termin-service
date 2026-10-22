import { useLoaderData } from "react-router";

import { requireUser } from "~/adapters/session/session";
import { Shell } from "~/components/shared/SchedulingShared";

export async function loader({ request }: { request: Request }) {
  return { user: await requireUser(request) };
}

export default function Home() {
  const { user } = useLoaderData<typeof loader>();
  return (
    <Shell title="Terminübersicht" user={user}>
      <p>Willkommen.</p>
    </Shell>
  );
}
