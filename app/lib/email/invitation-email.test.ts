// @vitest-environment node
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { renderInvitationEmail } from "./invitation-email.ts";

const surveyUrl = "http://localhost:3000/verhandlungstermin-finder/umfrage/tok-1";
const email = {
  aktenzeichen: "574 C 65412/26",
  surveyUrl,
  // 09:00 bis 10:30 Berlin time in summer.
  slots: [
    {
      id: "slot-1",
      start: new Date("2026-09-17T07:00:00Z"),
      end: new Date("2026-09-17T08:30:00Z"),
    },
  ],
};

describe("renderInvitationEmail", () => {
  it("invites the guest to the survey", () => {
    const mail = renderInvitationEmail(email);
    expect(mail.subject).toBe("Einladung zur Terminumfrage");
    expect(mail.html).toContain("Sie sind eingeladen");
    expect(mail.text).toContain("Sie sind eingeladen");
  });

  it("lists the Aktenzeichen and the windows in Berlin time", () => {
    const { html, text } = renderInvitationEmail(email);
    for (const body of [html, text]) {
      expect(body).toContain("574 C 65412/26");
      expect(body).toContain("Donnerstag, 17.09.2026, 09:00 bis 10:30 Uhr");
    }
  });

  it("links to the personal survey as button and as plain link", () => {
    const { html, text } = renderInvitationEmail(email);
    expect(html).toContain(`href="${surveyUrl}"`);
    expect(text).toContain(`\n${surveyUrl}\n`);
  });

  it("escapes the Aktenzeichen in the HTML version", () => {
    const { html } = renderInvitationEmail({ ...email, aktenzeichen: "<b>A 1</b>" });
    expect(html).toContain("&lt;b&gt;A 1&lt;/b&gt;");
    expect(html).not.toContain("<b>A 1</b>");
  });

  it("attaches only the logo, no calendar", () => {
    const { attachments } = renderInvitationEmail(email);
    expect(attachments.map(({ filename }) => filename)).toEqual(["bmjv-logo.png"]);
  });

  it("embeds the logo from the bundle, inline under its content id", () => {
    const [logo] = renderInvitationEmail(email).attachments;
    expect(logo).toMatchObject({ contentType: "image/png", contentDisposition: "inline" });
    expect(logo!.content).toEqual(readFileSync(new URL("bmjv-logo.png", import.meta.url)));
  });
});
