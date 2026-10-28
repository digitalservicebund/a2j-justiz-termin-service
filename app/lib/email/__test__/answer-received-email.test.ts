// @vitest-environment node
import ICAL from "ical.js";
import { describe, expect, it } from "vitest";

import type { ResponseOverview } from "~/adapters/appointments/survey.server";

import { renderAnswerReceivedEmail } from "../answer-received-email";

const terminUrl = "http://localhost:3000/overview/a1";

// 09:00 – 10:30, 14:00 – 15:00 and 16:00 – 17:00 Berlin time in summer.
const times = {
  s1: { start: new Date("2026-09-17T07:00:00Z"), end: new Date("2026-09-17T08:30:00Z") },
  s2: { start: new Date("2026-09-18T12:00:00Z"), end: new Date("2026-09-18T13:00:00Z") },
  s3: { start: new Date("2026-09-18T14:00:00Z"), end: new Date("2026-09-18T15:00:00Z") },
};
const guestA = { participantId: "p1", name: "Guest A" };
const guestB = { participantId: "p2", name: "Guest B" };

// Guest A was available for s1 and s2 and ruled s3 out. Guest B then saw only s1 and s2.
function overview(
  guestBAnswers: Record<"s1" | "s2", boolean> = { s1: true, s2: true },
): ResponseOverview {
  return {
    appointmentId: "a1",
    aktenzeichen: "574 C 65412/26",
    judgeEmail: "judge.a@example.com",
    calendarSequence: 7,
    slots: [
      {
        id: "s1",
        ...times.s1,
        responses: [
          { ...guestA, available: true },
          { ...guestB, available: guestBAnswers.s1 },
        ],
      },
      {
        id: "s2",
        ...times.s2,
        responses: [
          { ...guestA, available: true },
          { ...guestB, available: guestBAnswers.s2 },
        ],
      },
      { id: "s3", ...times.s3, responses: [{ ...guestA, available: false }] },
    ],
  };
}

const render = (guestBAnswers?: Record<"s1" | "s2", boolean>) =>
  renderAnswerReceivedEmail({
    overview: overview(guestBAnswers),
    responder: { id: "p2", name: "Guest B" },
    terminUrl,
    organizerEmail: "sender@example.com",
  });

function events(mail: ReturnType<typeof render>) {
  const calendar = mail.attachments.find(({ filename }) => filename === "terminumfrage.ics")!;
  return new ICAL.Component(ICAL.parse(String(calendar.content))).getAllSubcomponents("vevent");
}

describe("renderAnswerReceivedEmail", () => {
  it("names the responder and links to the Termin", () => {
    const { subject, html, text } = render();
    expect(subject).toBe("Neue Antwort auf Ihre Terminumfrage");
    for (const body of [html, text]) {
      expect(body).toContain("Guest B hat auf Ihre Terminumfrage geantwortet.");
      expect(body).toContain("574 C 65412/26");
    }
    expect(html).toContain(`href="${terminUrl}"`);
    expect(text).toContain(`\n${terminUrl}\n`);
  });

  it("lists the windows the responder is available for and those that are cancelled", () => {
    const { text } = render({ s1: true, s2: false });
    const [, available, rest] = text.split(/Verfügbar:\n|Nicht verfügbar:\n/);
    expect(available).toContain("Donnerstag, 17.09.2026, 09:00 – 10:30 Uhr");
    expect(available).not.toContain("14:00");
    expect(rest).toContain("Diese Zeitfenster wurden abgesagt.");
    expect(rest).toContain("Freitag, 18.09.2026, 14:00 – 15:00 Uhr");
  });

  it("shows the state of every window, including those an earlier answer cancelled", () => {
    const { text } = render();
    expect(text).toContain("09:00 – 10:30 Uhr: verfügbar: Guest A, Guest B");
    expect(text).toContain("16:00 – 17:00 Uhr: abgesagt");
  });

  it("says so when no window is left", () => {
    const { text, html } = render({ s1: false, s2: false });
    expect(text).toContain("Es ist kein Zeitfenster mehr möglich.");
    expect(html).toContain("Es ist kein Zeitfenster mehr möglich.");
    expect(render().text).not.toContain("kein Zeitfenster mehr");
  });

  it("escapes a hostile name in the HTML version and keeps it raw in the text", () => {
    const hostile = '<script>alert("x")</script>';
    const mail = renderAnswerReceivedEmail({
      overview: overview(),
      responder: { id: "p2", name: hostile },
      terminUrl,
      organizerEmail: "sender@example.com",
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.text).toContain(hostile);
  });

  describe("calendar attachment", () => {
    it("cancels the windows someone cannot attend and keeps the rest tentative", () => {
      const [s1, s2, s3] = events(render({ s1: true, s2: false }));
      expect(s1!.getFirstPropertyValue("status")).toBe("TENTATIVE");
      expect(s1!.getFirstPropertyValue("transp")).toBe("OPAQUE");
      for (const event of [s2!, s3!]) {
        expect(event.getFirstPropertyValue("status")).toBe("CANCELLED");
        expect(event.getFirstPropertyValue("transp")).toBe("TRANSPARENT");
        expect(event.getFirstPropertyValue("summary")).toBe("Abgesagt: Verhandlung 574 C 65412/26");
      }
    });

    it("lists who is available in the description of an open window", () => {
      const [s1] = events(render());
      const description = String(s1!.getFirstPropertyValue("description"));
      expect(description).toContain("Verfügbar: Guest A, Guest B");
      expect(description).toContain(terminUrl);
    });

    it("links to the Termin in a cancelled event too", () => {
      const [, , s3] = events(render());
      expect(String(s3!.getFirstPropertyValue("description"))).toContain(terminUrl);
    });

    it("keeps the UIDs of the first mail and takes the sequence from the overview", () => {
      const uids = events(render()).map((event) => event.getFirstPropertyValue("uid"));
      expect(uids).toEqual(["timeslot-s1", "timeslot-s2", "timeslot-s3"]);
      for (const event of events(render())) {
        expect(event.getFirstPropertyValue("sequence")).toBe(7);
        expect(String(event.getFirstProperty("organizer")!.getFirstValue())).toBe(
          "mailto:sender@example.com",
        );
      }
    });
  });
});
