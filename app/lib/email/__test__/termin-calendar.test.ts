// @vitest-environment node
import ICAL from "ical.js";
import { describe, expect, it } from "vitest";

import { createTerminCalendar } from "../termin-calendar";

const terminUrl = "http://localhost:3000/overview/a1";
const slots = [
  { start: new Date("2026-09-17T07:00:00Z"), end: new Date("2026-09-17T08:30:00Z") },
  { start: new Date("2026-09-18T09:00:00Z"), end: new Date("2026-09-18T10:00:00Z") },
];

function build(aktenzeichen = "574 C 65412/26") {
  return createTerminCalendar({
    appointmentId: "a1",
    aktenzeichen,
    slots,
    terminUrl,
    now: new Date("2026-09-01T12:00:00Z"),
  });
}

const parse = (body: string) => new ICAL.Component(ICAL.parse(body));

const uids = (body: string) =>
  parse(body)
    .getAllSubcomponents("vevent")
    .map((event) => event.getFirstPropertyValue("uid"));

describe("createTerminCalendar", () => {
  it("is a valid calendar with CRLF lines of at most 75 octets", () => {
    const body = build();
    expect(body.startsWith("BEGIN:VCALENDAR\r\n")).toBe(true);
    expect(body.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(body.replaceAll("\r\n", "")).not.toMatch(/[\r\n]/);
    for (const line of body.split("\r\n")) {
      expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
    }
    expect(parse(body).getFirstPropertyValue("method")).toBe("PUBLISH");
  });

  it("adds one tentative, busy event per time slot", () => {
    const events = parse(build()).getAllSubcomponents("vevent");
    expect(events).toHaveLength(2);

    const [first, second] = events.map((event) => new ICAL.Event(event));
    expect(first!.startDate.toJSDate()).toEqual(slots[0]!.start);
    expect(first!.endDate.toJSDate()).toEqual(slots[0]!.end);
    expect(second!.startDate.toJSDate()).toEqual(slots[1]!.start);
    expect(second!.uid).not.toBe(first!.uid);
    for (const event of events) {
      expect(event.getFirstPropertyValue("status")).toBe("TENTATIVE");
      expect(event.getFirstPropertyValue("transp")).toBe("OPAQUE");
    }
  });

  it("keeps the same UID for the same slot, so a re-issued calendar replaces the events", () => {
    expect(uids(build())).toEqual(uids(build()));
  });

  it("links to the Termin in the description and the URL property", () => {
    const [event] = parse(build()).getAllSubcomponents("vevent");
    expect(event!.getFirstPropertyValue("description")).toContain(terminUrl);
    expect(event!.getFirstPropertyValue("url")).toBe(terminUrl);
    expect(event!.getFirstPropertyValue("summary")).toBe("Vorläufig: Verhandlung 574 C 65412/26");
  });

  it("escapes characters that would end a property or add one", () => {
    const hostile = "A 1; B, C\\D\r\nATTENDEE:mailto:person.a@example.com";
    const body = build(hostile);
    expect(body).not.toMatch(/^ATTENDEE:/m);
    const [event] = parse(body).getAllSubcomponents("vevent");
    expect(event!.getFirstPropertyValue("summary")).toBe(
      "Vorläufig: Verhandlung A 1; B, C\\D\nATTENDEE:mailto:person.a@example.com",
    );
  });

  it("does not split a multi-byte character when folding", () => {
    const body = build("ä".repeat(80));
    const [event] = parse(body).getAllSubcomponents("vevent");
    expect(event!.getFirstPropertyValue("summary")).toBe(
      `Vorläufig: Verhandlung ${"ä".repeat(80)}`,
    );
  });
});
