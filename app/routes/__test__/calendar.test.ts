import ICAL from "ical.js";
import { createStaticHandler } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loader } from "../calendar";

const handler = createStaticHandler([{ path: "/api/calendars/:calendarId/feed.ics", loader }]);

async function requestCalendar(calendarId = "demo"): Promise<Response> {
  const response = await handler.queryRoute(
    new Request(`http://localhost/api/calendars/${calendarId}/feed.ics`),
  );
  expect(response).toBeInstanceOf(Response);
  return response as Response;
}

async function parseCalendar(): Promise<ICAL.Component> {
  const response = await requestCalendar();
  const calendar = new ICAL.Component(ICAL.parse(await response.text()));
  const timezone = calendar.getFirstSubcomponent("vtimezone");
  expect(timezone).not.toBeNull();
  ICAL.TimezoneService.register(new ICAL.Timezone(timezone!));
  return calendar;
}

describe("calendar subscription", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-13T12:00:00.000Z"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    ICAL.TimezoneService.reset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    ICAL.TimezoneService.reset();
  });

  it("serves a public calendar response without caching", async () => {
    const response = await requestCalendar();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/calendar; charset=utf-8; method=PUBLISH",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    const body = await response.text();
    expect(body.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(body.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
    expect(body.split("\r\n").every((line) => line.length <= 75)).toBe(true);
  });

  it("logs the decoded ID but returns identical content for all IDs at the same time", async () => {
    const first = await (await requestCalendar("calendar%20one")).text();
    const second = await (await requestCalendar("other-calendar")).text();
    const refreshed = await (await requestCalendar("calendar%20one")).text();

    expect(console.log).toHaveBeenNthCalledWith(1, "calendar one");
    expect(console.log).toHaveBeenNthCalledWith(2, "other-calendar");
    expect(console.log).toHaveBeenNthCalledWith(3, "calendar one");
    expect(first).toBe(second);
    expect(first).toBe(refreshed);
    expect(first).not.toContain("calendar one");
    expect(first).not.toContain("other-calendar");
  });

  it("does not match a subscription URL without an ID", async () => {
    await expect(
      handler.queryRoute(new Request("http://localhost/api/calendars/feed.ics")),
    ).rejects.toMatchObject({ status: 404 });
    expect(console.log).not.toHaveBeenCalled();
  });

  it("publishes calendar-level names, descriptions, color, and five-minute refresh hints", async () => {
    const calendar = await parseCalendar();
    expect(calendar.getFirstPropertyValue("method")).toBe("PUBLISH");
    for (const name of ["name", "x-wr-calname"]) {
      expect(calendar.getFirstPropertyValue(name)).toBe("JTS Demo");
    }
    for (const name of ["description", "x-wr-caldesc"]) {
      expect(calendar.getFirstPropertyValue(name)).toBe(
        "Public mock calendar for Justiz Termin Service.",
      );
    }
    expect(calendar.getFirstPropertyValue("color")).toBe("midnightblue");
    const refresh = calendar.getFirstProperty("refresh-interval")!;
    expect(refresh.type).toBe("duration");
    expect(refresh.getFirstValue()?.toString()).toBe("PT5M");
    expect(ICAL.Duration.fromString(refresh.getFirstValue()!.toString()).toSeconds()).toBe(300);
    expect(calendar.getFirstPropertyValue("x-published-ttl")?.toString()).toBe("PT5M");
    for (const name of [
      "method",
      "name",
      "x-wr-calname",
      "description",
      "x-wr-caldesc",
      "color",
      "refresh-interval",
      "x-published-ttl",
    ]) {
      expect(calendar.getAllProperties(name)).toHaveLength(1);
      if (name !== "description") {
        expect(calendar.getFirstSubcomponent("vevent")!.hasProperty(name)).toBe(false);
      }
    }
  });

  it("contains only the agreed recurring event and a Berlin timezone", async () => {
    const calendar = await parseCalendar();
    expect(calendar.name).toBe("vcalendar");
    expect(calendar.getFirstPropertyValue("version")).toBe("2.0");
    expect(calendar.getAllSubcomponents("vevent")).toHaveLength(1);
    expect(calendar.getAllSubcomponents("vtimezone")).toHaveLength(1);

    const component = calendar.getFirstSubcomponent("vevent")!;
    const event = new ICAL.Event(component);
    expect(event.summary).toBe("Test Termin");
    expect(event.uid).toBe("test-termin@justiz-termin-service.invalid");
    expect(component.getFirstPropertyValue("dtstamp")?.toString()).toBe("2026-10-13T12:00:00Z");
    expect(component.getFirstPropertyValue("last-modified")?.toString()).toBe(
      "2026-10-13T12:00:00Z",
    );
    expect(event.description).toBe(
      "Last synchronized (feed generated):\n13 October 2026 at 14:00:00 CEST",
    );
    expect(component.getFirstPropertyValue("created")?.toString()).toBe("2026-10-13T00:00:00Z");
    expect(event.startDate.toString()).toBe("2026-10-13T13:20:00");
    expect(event.endDate.toString()).toBe("2026-10-13T14:20:00");
    expect(event.startDate.zone.tzid).toBe("Europe/Berlin");
    expect(event.endDate.zone.tzid).toBe("Europe/Berlin");
    expect(component.getFirstPropertyValue("rrule")?.toString()).toBe("FREQ=WEEKLY;BYDAY=TU");
    for (const name of ["attendee", "location"]) {
      expect(component.hasProperty(name)).toBe(false);
    }
    expect(component.getAllSubcomponents("valarm")).toHaveLength(0);
  });

  it("updates synchronization details per request without changing event identity or schedule", async () => {
    const first = new ICAL.Event((await parseCalendar()).getFirstSubcomponent("vevent")!);
    vi.setSystemTime(new Date("2026-10-13T12:05:00.000Z"));
    const refreshed = new ICAL.Event((await parseCalendar()).getFirstSubcomponent("vevent")!);

    expect(first.description).toBe(
      "Last synchronized (feed generated):\n13 October 2026 at 14:00:00 CEST",
    );
    expect(refreshed.description).toBe(
      "Last synchronized (feed generated):\n13 October 2026 at 14:05:00 CEST",
    );
    for (const name of ["dtstamp", "last-modified"]) {
      expect(refreshed.component.getFirstPropertyValue(name)?.toString()).toBe(
        "2026-10-13T12:05:00Z",
      );
    }
    expect(refreshed.uid).toBe(first.uid);
    for (const name of ["created", "dtstart", "dtend", "rrule"]) {
      expect(refreshed.component.getFirstPropertyValue(name)?.toString()).toBe(
        first.component.getFirstPropertyValue(name)?.toString(),
      );
    }
  });

  it.each([
    ["2026-10-13T12:00:00Z", "13 October 2026 at 14:00:00 CEST"],
    ["2026-10-27T12:00:00Z", "27 October 2026 at 13:00:00 CET"],
    ["2026-10-13T22:30:00Z", "14 October 2026 at 00:30:00 CEST"],
  ])("formats synchronization time in Berlin for %s", async (timestamp, expected) => {
    vi.setSystemTime(new Date(timestamp));
    const calendar = await parseCalendar();
    const event = new ICAL.Event(calendar.getFirstSubcomponent("vevent")!);
    expect(event.description).toBe(`Last synchronized (feed generated):\n${expected}`);
  });

  it.each([
    ["2026-10-20", "2026-10-20T11:20:00.000Z"],
    ["2026-10-27", "2026-10-27T12:20:00.000Z"],
    ["2027-03-23", "2027-03-23T12:20:00.000Z"],
    ["2027-03-30", "2027-03-30T11:20:00.000Z"],
  ])("keeps 13:20-14:20 Berlin time on %s", async (date, utcStart) => {
    const calendar = await parseCalendar();
    const event = new ICAL.Event(calendar.getFirstSubcomponent("vevent")!);
    const iterator = event.iterator();
    let occurrence = iterator.next();
    while (occurrence && occurrence.toString().slice(0, 10) < date) {
      occurrence = iterator.next();
    }

    expect(occurrence?.toString()).toBe(`${date}T13:20:00`);
    const details = event.getOccurrenceDetails(occurrence!);
    expect(details.startDate.toJSDate().toISOString()).toBe(utcStart);
    expect(details.endDate.toString()).toBe(`${date}T14:20:00`);
    expect(details.endDate.toJSDate().getTime() - details.startDate.toJSDate().getTime()).toBe(
      60 * 60 * 1000,
    );
    expect(details.startDate.toJSDate().getUTCDay()).toBe(2);
  });
});
