import html from "html-template-tag";

import type { Slot } from "../../core/domain/availability.ts";
import { formatRange } from "../../core/domain/time/format.ts";
import {
  Button,
  COLOR,
  Divider,
  Footer,
  Header,
  Layout,
  Slots,
  TextRow,
  logoAttachment,
  renderFooterText,
  renderHeaderText,
} from "./email-parts.ts";

const SUBJECT = "Einladung zur Terminumfrage";
const HEADING = "Sie sind eingeladen, Ihre Verfügbarkeit für einen Verhandlungstermin anzugeben.";
const BUTTON = "Zur Terminumfrage";
const LINK_HINT =
  "Der Link ist persönlich. Bitte leiten Sie ihn nicht weiter, Sie können nur einmal antworten.";

export type InvitationEmail = {
  aktenzeichen: string;
  // The name of the court. Older Terminumfragen have none.
  court: string | null;
  slots: Slot[];
  surveyUrl: string;
};

function Content({ aktenzeichen, court, surveyUrl }: InvitationEmail, slots: string[]) {
  return html`<tr>
    <td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        $${TextRow({ children: html`${HEADING}`, padding: "0 0 16px 0", size: 21, color: COLOR.text, bold: true })}
        $${TextRow({ children: html`Aktenzeichen: ${aktenzeichen}`, padding: "0 0 8px 0", size: 18, color: COLOR.text })}
        $${court ? TextRow({ children: html`Gericht: ${court}`, padding: "0 0 8px 0", size: 18, color: COLOR.text }) : ""}
        $${TextRow({ children: html`Vorgeschlagene Zeitfenster:`, padding: "0 0 4px 0", size: 18, color: COLOR.text, bold: true })}
        $${Slots(slots)} $${Button(BUTTON, surveyUrl)}
        $${TextRow({ children: html`${LINK_HINT}`, padding: "0 0 32px 0", size: 18, color: COLOR.muted })}
        $${Divider("0 0 24px 0")} $${Footer()}
      </table>
    </td>
  </tr>`;
}

function renderText({ aktenzeichen, court, surveyUrl }: InvitationEmail, slots: string[]) {
  return [
    ...renderHeaderText(),
    "",
    HEADING,
    "",
    `Aktenzeichen: ${aktenzeichen}`,
    ...(court ? [`Gericht: ${court}`] : []),
    "Vorgeschlagene Zeitfenster:",
    ...slots.map((slot) => `- ${slot}`),
    "",
    `${BUTTON}:`,
    surveyUrl,
    "",
    LINK_HINT,
    "",
    "--",
    ...renderFooterText(),
    "",
  ].join("\n");
}

// Invites a guest to the survey with their personal link.
export function renderInvitationEmail(email: InvitationEmail) {
  const slots = email.slots.map(formatRange);
  return {
    subject: SUBJECT,
    text: renderText(email, slots),
    html: Layout(
      { subject: SUBJECT, preheader: HEADING },
      html`$${Header()} $${Divider("0 0 40px 0")} $${Content(email, slots)}`,
    ),
    attachments: [logoAttachment()],
  };
}
