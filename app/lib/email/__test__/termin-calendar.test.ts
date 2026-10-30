// @vitest-environment node
import ICAL from "ical.js";
import { describe, expect, it } from "vitest";

import { createTerminCalendar, createTerminEvents, wrapCalendar } from "../termin-calendar";

const terminUrl = "http://localhost:3000/overview/a1";
const organizerEmail = "sender@example.com";
const slots = [
  { id: "slot-1", start: new Date("2026-09-17T07:00:00Z"), end: new Date("2026-09-17T08:30:00Z") },
  { id: "slot-2", start: new Date("2026-09-18T09:00:00Z"), end: new Date("2026-09-18T10:00:00Z") },
];

function build(aktenzeichen = "574 C 65412/26") {
  return createTerminCalendar({
    aktenzeichen,
    slots,
    terminUrl,
    sequence: 0,
    organizerEmail,
    now: new Date("2026-09-01T12:00:00Z"),
  });
}

const parse = (body: string) => new ICAL.Component(ICAL.parse(body));

const sequences = (body: string) =>
  parse(body)
    .getAllSubcomponents("vevent")
    .map((event) => event.getFirstPropertyValue("sequence"));

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

  it("uses the id of the time slot as UID, so a moved slot updates its event", () => {
    expect(uids(build())).toEqual(["timeslot-slot-1", "timeslot-slot-2"]);

    const moved = createTerminCalendar({
      aktenzeichen: "574 C 65412/26",
      sequence: 0,
      organizerEmail,
      slots: [
        {
          ...slots[0]!,
          start: new Date("2026-09-19T07:00:00Z"),
          end: new Date("2026-09-19T08:00:00Z"),
        },
        slots[1]!,
      ],
      terminUrl,
    });
    expect(uids(moved)).toEqual(uids(build()));
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

  it("starts at sequence 0 and takes the given sequence for a re-issued calendar", () => {
    expect(sequences(build())).toEqual([0, 0]);
    expect(
      sequences(
        createTerminCalendar({
          aktenzeichen: "A 1",
          slots,
          terminUrl,
          sequence: 3,
          organizerEmail,
        }),
      ),
    ).toEqual([3, 3]);
  });

  it("cancels a slot and lists who is available in the others", () => {
    const body = createTerminCalendar({
      aktenzeichen: "A 1",
      terminUrl,
      sequence: 1,
      organizerEmail,
      slots: [
        { ...slots[0]!, availableNames: ["Guest A", "Guest B"] },
        { ...slots[1]!, cancelled: true, availableNames: ["Guest A"] },
      ],
    });
    const [open, cancelled] = parse(body).getAllSubcomponents("vevent");
    expect(open!.getFirstPropertyValue("status")).toBe("TENTATIVE");
    expect(open!.getFirstPropertyValue("description")).toContain("Verfügbar: Guest A, Guest B");
    expect(cancelled!.getFirstPropertyValue("status")).toBe("CANCELLED");
    expect(cancelled!.getFirstPropertyValue("description")).toMatch(/^Abgesagt: /);
  });

  it("shows a dash while nobody is available", () => {
    const body = createTerminCalendar({
      aktenzeichen: "A 1",
      terminUrl,
      sequence: 1,
      organizerEmail,
      slots: [{ ...slots[0]!, availableNames: [] }],
    });
    const [event] = parse(body).getAllSubcomponents("vevent");
    expect(event!.getFirstPropertyValue("description")).toContain("Verfügbar: –");
  });

  it("names the service as organizer, with the sending address, on every event", () => {
    const events = parse(build()).getAllSubcomponents("vevent");
    for (const event of events) {
      const organizer = event.getFirstProperty("organizer")!;
      expect(organizer.getFirstValue()).toBe("mailto:sender@example.com");
      expect(organizer.getParameter("cn")).toBe("Verhandlungstermin-Finder");
      expect(event.getFirstProperty("attendee")).toBeNull();
    }
  });

  it("marks open slots as tentative and cancelled ones as free for Outlook", () => {
    const body = createTerminCalendar({
      aktenzeichen: "A 1",
      terminUrl,
      sequence: 1,
      organizerEmail,
      slots: [slots[0]!, { ...slots[1]!, cancelled: true }],
    });
    const [open, cancelled] = parse(body).getAllSubcomponents("vevent");
    expect(open!.getFirstPropertyValue("x-microsoft-cdo-busystatus")).toBe("TENTATIVE");
    expect(cancelled!.getFirstPropertyValue("x-microsoft-cdo-busystatus")).toBe("FREE");
  });
});

describe("createTerminEvents", () => {
  it("leaves out the organizer and the synchronization line unless asked", () => {
    const [event] = parse(
      wrapCalendar(createTerminEvents({ aktenzeichen: "A 1", slots, terminUrl, sequence: 0 })),
    ).getAllSubcomponents("vevent");
    expect(event!.hasProperty("organizer")).toBe(false);
    expect(event!.getFirstPropertyValue("description")).not.toContain("synchronisiert");
  });

  it("marks the confirmed slot as confirmed and busy", () => {
    const [event] = parse(
      wrapCalendar(
        createTerminEvents({
          aktenzeichen: "A 1",
          slots: [{ ...slots[0]!, confirmed: true }],
          terminUrl,
          sequence: 0,
          synchronizedAt: new Date("2026-01-15T11:00:00Z"),
        }),
      ),
    ).getAllSubcomponents("vevent");
    expect(event!.getFirstPropertyValue("status")).toBe("CONFIRMED");
    expect(event!.getFirstPropertyValue("summary")).toBe("Bestätigt: Verhandlung A 1");
    expect(event!.getFirstPropertyValue("description")).toMatch(
      /^Bestätigter Termin für die Verhandlung A 1\.\n\n.*\n\nZuletzt synchronisiert: 15\. Januar 2026 um 12:00:00 MEZ$/,
    );
    expect(event!.getFirstPropertyValue("x-microsoft-cdo-busystatus")).toBe("BUSY");
  });
});
