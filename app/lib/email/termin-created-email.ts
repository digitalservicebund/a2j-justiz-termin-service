import html from "html-template-tag";

import type {
  AppointmentSlot,
  TimeRange,
} from "../../adapters/appointments/appointments.server.ts";
import {
  Button,
  COLOR,
  Divider,
  Footer,
  Header,
  Layout,
  TextRow,
  logoAttachment,
  renderFooterText,
  renderHeaderText,
} from "./email-parts.ts";
import { createTerminCalendar, TERMIN_CALENDAR_CONTENT_TYPE } from "./termin-calendar.ts";

const SUBJECT = "Terminumfrage erstellt: Wir warten auf Rückmeldungen";
const HEADING = "Ihre Terminumfrage wurde erstellt. Wir warten auf die Rückmeldungen.";
const BUTTON = "Termin öffnen";
const CALENDAR_HINT =
  "Die vorgeschlagenen Zeitfenster sind als vorläufige Kalendereinträge angehängt, damit Sie sich diese Zeiten freihalten.";
const CALENDAR_FILENAME = "terminumfrage.ics";

const dayFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const timeFormat = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  hour: "2-digit",
  minute: "2-digit",
});

const describeSlot = ({ start, end }: TimeRange) =>
  `${dayFormat.format(start)}, ${timeFormat.format(start)} – ${timeFormat.format(end)} Uhr`;

export type TerminCreatedEmail = {
  aktenzeichen: string;
  slots: AppointmentSlot[];
  terminUrl: string;
};

function Slots(slots: string[]) {
  return html`<tr>
    <td style="padding:0 0 16px 0;">
      <ul style="margin:0;padding:0 0 0 24px;">
        $${slots
          .map(
            (slot) =>
              html`<li style="font-size:18px;line-height:24px;color:${COLOR.text};">${slot}</li>`,
          )
          .join("")}
      </ul>
    </td>
  </tr>`;
}

function Content({ aktenzeichen, terminUrl }: TerminCreatedEmail, slots: string[]) {
  return html`<tr>
    <td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        $${TextRow({ children: html`${HEADING}`, padding: "0 0 16px 0", size: 21, color: COLOR.text, bold: true })}
        $${TextRow({ children: html`Aktenzeichen: ${aktenzeichen}`, padding: "0 0 8px 0", size: 18, color: COLOR.text })}
        $${TextRow({ children: html`Vorgeschlagene Zeitfenster:`, padding: "0 0 4px 0", size: 18, color: COLOR.text, bold: true })}
        $${Slots(slots)} $${Button(BUTTON, terminUrl)}
        $${TextRow({ children: html`${CALENDAR_HINT}`, padding: "0 0 32px 0", size: 18, color: COLOR.muted })}
        $${Divider("0 0 24px 0")} $${Footer()}
      </table>
    </td>
  </tr>`;
}

function renderText({ aktenzeichen, terminUrl }: TerminCreatedEmail, slots: string[]) {
  return [
    ...renderHeaderText(),
    "",
    HEADING,
    "",
    `Aktenzeichen: ${aktenzeichen}`,
    "Vorgeschlagene Zeitfenster:",
    ...slots.map((slot) => `- ${slot}`),
    "",
    `${BUTTON}, um Änderungen vorzunehmen oder einen Termin zu bestätigen:`,
    terminUrl,
    "",
    CALENDAR_HINT,
    "",
    "--",
    ...renderFooterText(),
    "",
  ].join("\n");
}

export function renderTerminCreatedEmail(email: TerminCreatedEmail) {
  const slots = email.slots.map(describeSlot);
  return {
    subject: SUBJECT,
    text: renderText(email, slots),
    html: Layout(
      { subject: SUBJECT, preheader: HEADING },
      html`$${Header()} $${Divider("0 0 40px 0")} $${Content(email, slots)}`,
    ),
    attachments: [
      logoAttachment(),
      {
        filename: CALENDAR_FILENAME,
        content: createTerminCalendar(email),
        contentType: TERMIN_CALENDAR_CONTENT_TYPE,
      },
    ],
  };
}
