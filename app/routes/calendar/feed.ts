import type { LoaderFunctionArgs } from "react-router";

import { readCalendarFeed } from "~/adapters/appointments/calendar-feed.server";
import { getDb } from "~/database/database";
import { createCalendarFeed } from "~/lib/calendar-feed";
import { requireEnv } from "~/lib/env";

// Calendar apps cannot sign in, so the token in the address is the credential. Never log it.
export async function loader({ params }: LoaderFunctionArgs): Promise<Response> {
  const appointments = await readCalendarFeed(getDb(), params.token ?? "");
  if (!appointments) throw new Response("Not Found", { status: 404 });

  return new Response(createCalendarFeed(appointments, requireEnv("BASE_URL")), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8; method=PUBLISH",
      "Cache-Control": "no-store",
    },
  });
}
