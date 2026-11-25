import { createRequestHandler } from "@react-router/express";
import "react-router";

import { settleErvInvitation } from "~/adapters/appointments/invitations.server";
import { getDb } from "~/database/database";
import { ervReplyHandler } from "~/lib/erv/erv-replies";
import { startErvVersand } from "~/lib/infra/erv-versand/erv-versand-connection";

export const app = createRequestHandler({
  build: () => import("virtual:react-router/server-build"),
});

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
