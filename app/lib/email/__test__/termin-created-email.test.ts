// @vitest-environment node
import { describe, expect, it } from "vitest";

import { renderTerminCreatedEmail } from "../termin-created-email";

const terminUrl = "http://localhost:3000/overview/a1";
const email = {
  appointmentId: "a1",
  aktenzeichen: "574 C 65412/26",
  terminUrl,
  // 09:00 – 10:30 and 14:00 – 15:00 Berlin time in summer.
  slots: [
    { start: new Date("2026-09-17T07:00:00Z"), end: new Date("2026-09-17T08:30:00Z") },
    { start: new Date("2026-09-18T12:00:00Z"), end: new Date("2026-09-18T13:00:00Z") },
  ],
};

describe("renderTerminCreatedEmail", () => {
  it("says the Terminumfrage is created and waiting for responses", () => {
    const mail = renderTerminCreatedEmail(email);
    expect(mail.subject).toBe("Terminumfrage erstellt: Wir warten auf Rückmeldungen");
    expect(mail.html).toContain("Ihre Terminumfrage wurde erstellt.");
    expect(mail.text).toContain("Wir warten auf die Rückmeldungen.");
  });

  it("lists the Aktenzeichen and the windows in Berlin time", () => {
    const { html, text } = renderTerminCreatedEmail(email);
    for (const body of [html, text]) {
      expect(body).toContain("574 C 65412/26");
      expect(body).toContain("Donnerstag, 17.09.2026, 09:00 – 10:30 Uhr");
      expect(body).toContain("Freitag, 18.09.2026, 14:00 – 15:00 Uhr");
    }
  });

  it("links to the Termin as button and as plain link", () => {
    const { html, text } = renderTerminCreatedEmail(email);
    expect(html).toContain(`href="${terminUrl}"`);
    expect(text).toContain(`\n${terminUrl}\n`);
  });

  it("escapes the Aktenzeichen and the link in the HTML version", () => {
    const mail = renderTerminCreatedEmail({
      ...email,
      aktenzeichen: "<script>alert(1)</script>",
      terminUrl: 'http://localhost/x?a=1&b="><script>',
    });
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("http://localhost/x?a=1&amp;b=&quot;&gt;&lt;script&gt;");
  });

  it("attaches the logo and a calendar file with the tentative windows", () => {
    const { attachments } = renderTerminCreatedEmail(email);
    expect(attachments.map(({ filename }) => filename)).toEqual([
      "bmjv-logo.png",
      "terminumfrage.ics",
    ]);
    const calendar = attachments[1]!;
    expect(calendar.contentType).toBe("text/calendar; charset=utf-8; method=PUBLISH");
    expect(String(calendar.content).match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(String(calendar.content)).toContain("STATUS:TENTATIVE");
  });
});
