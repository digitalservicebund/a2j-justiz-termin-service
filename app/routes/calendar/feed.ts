import { redirect, type LoaderFunctionArgs } from "react-router";

import { readCalendarFeed } from "~/adapters/appointments/calendar-feed.server";
import { getDb } from "~/database/database";
import { createCalendarFeed } from "~/lib/calendar/calendar-feed";
import { requireEnv } from "~/lib/infra/env";
import { calendarOpenedInBrowserPath } from "~/lib/web/paths";

// Browsers send Sec-Fetch-Dest: document when the user opens an address. Calendar apps fetch the
// feed in the background (Apple, classic Outlook) or from their servers (Google, Exchange) and
// never send it. A browser would download the file or import it once, without updates, so it is
// sent to the page that explains how to subscribe. User agents are not checked: a wrong guess there
// would stop a real calendar from syncing.
const isBrowserNavigation = (request: Request) =>
  request.headers.get("Sec-Fetch-Dest") === "document";

// Calendar apps cannot sign in, so the token in the address is the credential. Never log it.
export async function loader({
  request,
  params,
}: Pick<LoaderFunctionArgs, "request" | "params">): Promise<Response> {
  // Before the token is read, so the redirect does not tell whether the token is valid.
  if (isBrowserNavigation(request)) {
    throw redirect(calendarOpenedInBrowserPath, { headers: { Vary: "Sec-Fetch-Dest" } });
  }

  const appointments = await readCalendarFeed(getDb(), params.token ?? "");
  if (!appointments) throw new Response("Not Found", { status: 404 });

  return new Response(createCalendarFeed(appointments, requireEnv("BASE_URL")), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8; method=PUBLISH",
      "Cache-Control": "no-store",
      Vary: "Sec-Fetch-Dest",
    },
  });
}
