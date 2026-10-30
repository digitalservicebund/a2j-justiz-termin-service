// @vitest-environment node
import ICAL from "ical.js";
import { describe, expect, it } from "vitest";

import type { FeedAppointment } from "../../adapters/appointments/calendar-feed.server";
import { calendarFeedPath, createCalendarFeed } from "../calendar-feed";

const now = new Date("2026-10-13T12:00:00Z");
const baseUrl = "http://localhost:3000";

const response = (name: string, available: boolean) => ({
  participantId: `p-${name}`,
  name,
  available,
});

const open: FeedAppointment = {
  id: "a1",
  aktenzeichen: "574 C 1/26",
  calendarSequence: 4,
  confirmed: null,
  slots: [
    {
      id: "s1",
      start: new Date("2026-11-02T08:00:00Z"),
      end: new Date("2026-11-02T09:00:00Z"),
      responses: [response("Guest A", true)],
    },
    {
      id: "s2",
      start: new Date("2026-11-03T08:00:00Z"),
      end: new Date("2026-11-03T09:00:00Z"),
      responses: [response("Guest A", true), response("Guest B", false)],
    },
  ],
};

const confirmed: FeedAppointment = {
  id: "a2",
  aktenzeichen: "574 C 2/26",
  calendarSequence: 1,
  confirmed: {
    slotId: "s3",
    start: new Date("2026-11-04T08:30:00Z"),
    end: new Date("2026-11-04T09:00:00Z"),
  },
  slots: [
    {
      id: "s3",
      start: new Date("2026-11-04T08:00:00Z"),
      end: new Date("2026-11-04T10:00:00Z"),
      responses: [],
    },
  ],
};

const events = (feed: string) => new ICAL.Component(ICAL.parse(feed)).getAllSubcomponents("vevent");

describe("createCalendarFeed", () => {
  it("is an empty but valid calendar without appointments", () => {
    const calendar = new ICAL.Component(ICAL.parse(createCalendarFeed([], baseUrl, now)));
    expect(calendar.getAllSubcomponents("vevent")).toHaveLength(0);
    expect(calendar.getFirstPropertyValue("method")).toBe("PUBLISH");
    expect(calendar.getFirstPropertyValue("x-wr-calname")).toBe("Verhandlungstermin-Finder");
    expect(calendar.getFirstPropertyValue("x-published-ttl")?.toString()).toBe("PT5M");
    expect(calendar.getFirstProperty("refresh-interval")?.getFirstValue()?.toString()).toBe("PT5M");
  });

  it("adds a tentative event per slot of an open appointment, cancelling declined ones", () => {
    const [first, second] = events(createCalendarFeed([open], baseUrl, now));

    expect(first!.getFirstPropertyValue("uid")).toBe("timeslot-s1");
    expect(first!.getFirstPropertyValue("status")).toBe("TENTATIVE");
    expect(first!.getFirstPropertyValue("summary")).toBe("Vorläufig: Verhandlung 574 C 1/26");
    expect(first!.getFirstPropertyValue("description")).toContain("Verfügbar: Guest A");
    expect(second!.getFirstPropertyValue("uid")).toBe("timeslot-s2");
    expect(second!.getFirstPropertyValue("status")).toBe("CANCELLED");
  });

  it("adds one confirmed event for the chosen window of a confirmed appointment", () => {
    const [event] = events(createCalendarFeed([confirmed], baseUrl, now));

    expect(events(createCalendarFeed([confirmed], baseUrl, now))).toHaveLength(1);
    const ical = new ICAL.Event(event!);
    expect(ical.uid).toBe("timeslot-s3");
    expect(ical.startDate.toJSDate()).toEqual(confirmed.confirmed!.start);
    expect(ical.endDate.toJSDate()).toEqual(confirmed.confirmed!.end);
    expect(event!.getFirstPropertyValue("status")).toBe("CONFIRMED");
    expect(event!.getFirstPropertyValue("summary")).toBe("Bestätigt: Verhandlung 574 C 2/26");
    expect(event!.getFirstPropertyValue("x-microsoft-cdo-busystatus")).toBe("BUSY");
  });

  it("links every event to its appointment and keeps the stored sequence", () => {
    const [first, , third] = events(createCalendarFeed([open, confirmed], baseUrl, now));

    expect(first!.getFirstPropertyValue("url")).toBe(
      "http://localhost:3000/verhandlungstermin-finder/overview/a1",
    );
    expect(third!.getFirstPropertyValue("url")).toBe(
      "http://localhost:3000/verhandlungstermin-finder/overview/a2",
    );
    expect(first!.getFirstPropertyValue("sequence")).toBe(4);
    expect(third!.getFirstPropertyValue("sequence")).toBe(1);
  });

  it("names no organizer, since the feed is not a mail", () => {
    for (const event of events(createCalendarFeed([open, confirmed], baseUrl, now))) {
      expect(event.hasProperty("organizer")).toBe(false);
    }
  });

  it("states when the calendar was last synchronized, in Berlin time", () => {
    for (const event of events(createCalendarFeed([open, confirmed], baseUrl, now))) {
      expect(event.getFirstPropertyValue("description")).toMatch(
        /\n\nZuletzt synchronisiert: 13\. Oktober 2026 um 14:00:00 MESZ$/,
      );
    }
  });
});

describe("calendarFeedPath", () => {
  it("puts the token between the API path and the file name below the base path", () => {
    expect(calendarFeedPath("abc")).toBe("/verhandlungstermin-finder/api/calendars/abc/feed.ics");
  });
});
