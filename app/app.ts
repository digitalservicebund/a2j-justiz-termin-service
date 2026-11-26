import { createRequestHandler } from "@react-router/express";
import "react-router";

import { settleErvInvitation } from "~/adapters/appointments/invitations.server";
import { getDb } from "~/database/database";
import { ervReplyHandler } from "~/lib/erv/erv-replies";
import { startErvVersand, stopErvVersand } from "~/lib/infra/erv-versand/erv-versand-connection";

export const app = createRequestHandler({
  build: () => import("virtual:react-router/server-build"),
});

// The routes of the app, for the access log, which names the route of a request instead of its path.
export async function routeManifest() {
  return (await import("virtual:react-router/server-build")).routes;
}

// Work beside the requests, started once by server.js: settling ERV invitations with the replies
// of the Basisdienst: ERV Versand. It reconnects by itself, so a broker that is down does not stop
// the server.
export function startBackgroundWork(): void {
  startErvVersand(
    ervReplyHandler((correlationId, settlement) =>
      settleErvInvitation(getDb(), correlationId, settlement),
    ),
  );
}

// Closes the connections the app holds, when server.js shuts down: the ERV Versand's and the
// database pool. Requests in flight have finished by then.
export async function closeConnections(): Promise<void> {
  await stopErvVersand();
  await getDb().destroy();
}
