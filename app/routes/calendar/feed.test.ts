// @vitest-environment node
import { createStaticHandler } from "react-router";
import { beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";
import { callLoader } from "~tests/route";

import { readCalendarFeed } from "~/adapters/appointments/calendar-feed.server";

import { loader } from "./feed";

vi.mock("~/adapters/appointments/calendar-feed.server", () => ({ readCalendarFeed: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const handler = createStaticHandler([{ path: "/api/calendars/:token/feed.ics", loader }]);
const token = "7d9f4c52-6f0e-4b52-9a4a-3c1f6a0f2b11";

function requestFeed(value = token, headers?: HeadersInit) {
  return handler.queryRoute(
    new Request(`http://localhost/api/calendars/${value}/feed.ics`, { headers }),
  );
}

describe("calendar feed route", () => {
  let log: MockInstance<typeof console.log>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("BASE_URL", "http://localhost:3000");
    log = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("serves the calendar of the token's user without caching", async () => {
    vi.mocked(readCalendarFeed).mockResolvedValue([]);

    const response = (await requestFeed()) as Response;

    expect(readCalendarFeed).toHaveBeenCalledWith({ db: true }, token);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8; method=PUBLISH",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.text();
    expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(body.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });

  it("sends a browser that opens the link to the subscription page, without reading the token", async () => {
    const request = new Request(`http://localhost/api/calendars/${token}/feed.ics`, {
      headers: { "Sec-Fetch-Dest": "document" },
    });

    const outcome = await callLoader(loader, { request, params: { token } });

    expect(outcome).toMatchObject({ status: 302, location: "/kalender-abonnieren?browser" });
    expect(outcome.headers.get("Vary")).toBe("Sec-Fetch-Dest");
    expect(readCalendarFeed).not.toHaveBeenCalled();
  });

  it("serves the feed to requests that do not open a page, such as a script's fetch", async () => {
    vi.mocked(readCalendarFeed).mockResolvedValue([]);

    const response = (await requestFeed(token, { "Sec-Fetch-Dest": "empty" })) as Response;

    expect(response.status).toBe(200);
    expect(response.headers.get("Vary")).toBe("Sec-Fetch-Dest");
  });

  it("answers an unknown token with 404 and never logs it", async () => {
    vi.mocked(readCalendarFeed).mockResolvedValue(undefined);

    await expect(requestFeed()).rejects.toMatchObject({ status: 404 });
    expect(log).not.toHaveBeenCalled();
  });

  it("does not match a subscription URL without a token", async () => {
    await expect(
      handler.queryRoute(new Request("http://localhost/api/calendars/feed.ics")),
    ).rejects.toMatchObject({ status: 404 });
    expect(readCalendarFeed).not.toHaveBeenCalled();
  });
});
