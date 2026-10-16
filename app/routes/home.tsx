import { Link, useLoaderData } from "react-router";

import { requireUser } from "~/adapters/session/session";
import { Shell } from "~/components/shared/SchedulingShared";
import { hasRole } from "~/core/domain/user";

export async function loader({ request }: { request: Request }) {
  return { user: await requireUser(request) };
}

export default function Home() {
  const { user } = useLoaderData<typeof loader>();
  return (
    <Shell title="Terminübersicht" user={user}>
      {hasRole(user, "richter") && (
        <section>
          <h2 className="kern-heading-small">Termine erstellen und verwalten</h2>
          <Link className="kern-link" to="/richter">
            Terminplanung öffnen
          </Link>
        </section>
      )}
      {(hasRole(user, "klaeger") || hasRole(user, "beklagter")) && (
        <section>
          <h2 className="kern-heading-small">Auf Terminvorschläge antworten</h2>
          {hasRole(user, "klaeger") && (
            <p>
              <Link className="kern-link" to="/klaeger">
                Als Kläger antworten
              </Link>
            </p>
          )}
          {hasRole(user, "beklagter") && (
            <p>
              <Link className="kern-link" to="/beklagter">
                Als Beklagter antworten
              </Link>
            </p>
          )}
        </section>
      )}
    </Shell>
  );
}
