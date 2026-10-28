import html from "html-template-tag";

import type { ResponseOverview } from "../../adapters/appointments/survey.server.ts";
import {
  Button,
  COLOR,
  Divider,
  Footer,
  Header,
  Layout,
  Slots,
  TextRow,
  describeSlot,
  logoAttachment,
  renderFooterText,
  renderHeaderText,
} from "./email-parts.ts";
import { createTerminCalendar, TERMIN_CALENDAR_CONTENT_TYPE } from "./termin-calendar.ts";

const SUBJECT = "Neue Antwort auf Ihre Terminumfrage";
const BUTTON = "Termin öffnen";
const CALENDAR_HINT =
  "Der Kalenderanhang aktualisiert Ihre Einträge: Abgesagte Zeitfenster sind als abgesagt markiert, bei den übrigen steht, wer verfügbar ist.";
const CALENDAR_FILENAME = "terminumfrage.ics";

export type AnswerReceivedEmail = {
  overview: ResponseOverview;
  responder: { id: string; name: string };
  terminUrl: string;
  organizerEmail: string;
};

type Slot = ResponseOverview["slots"][number];

// A window one participant cannot attend is off the table for everyone.
const isCancelled = ({ responses }: Slot) => responses.some(({ available }) => !available);
const availableNames = ({ responses }: Slot) =>
  responses.filter(({ available }) => available).map(({ name }) => name);

// What the mail says, apart from layout: kept as plain strings so the text and HTML versions agree.
function summarize({ overview, responder }: AnswerReceivedEmail) {
  const answered = (available: boolean) =>
    overview.slots
      .filter(({ responses }) =>
        responses.some((r) => r.participantId === responder.id && r.available === available),
      )
      .map(describeSlot);
  const open = overview.slots.filter((slot) => !isCancelled(slot));

  return {
    heading: `${responder.name} hat auf Ihre Terminumfrage geantwortet.`,
    available: answered(true),
    cancelled: answered(false),
    // Windows an earlier answer already cancelled are listed too, so the mail shows the full state.
    states: overview.slots.map((slot) => {
      const names = availableNames(slot);
      return `${describeSlot(slot)}: ${isCancelled(slot) ? "abgesagt" : `verfügbar: ${names.join(", ")}`}`;
    }),
    nothingLeft: open.length === 0,
  };
}

function Section(title: string, items: string[], note?: string) {
  return html`$${TextRow({ children: html`${title}`, padding: "0 0 4px 0", size: 18, color: COLOR.text, bold: true })}
  $${note ? TextRow({ children: html`${note}`, padding: "0 0 4px 0", size: 18, color: COLOR.muted }) : ""}
  $${items.length > 0 ? Slots(items) : TextRow({ children: html`–`, padding: "0 0 16px 0", size: 18, color: COLOR.text })}`;
}

function Content(email: AnswerReceivedEmail, summary: ReturnType<typeof summarize>) {
  return html`<tr>
    <td>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        $${TextRow({ children: html`${summary.heading}`, padding: "0 0 16px 0", size: 21, color: COLOR.text, bold: true })}
        $${TextRow({ children: html`Aktenzeichen: ${email.overview.aktenzeichen}`, padding: "0 0 16px 0", size: 18, color: COLOR.text })}
        $${Section("Verfügbar", summary.available)}
        $${Section("Nicht verfügbar", summary.cancelled, summary.cancelled.length > 0 ? "Diese Zeitfenster wurden abgesagt." : undefined)}
        $${Section("Aktueller Stand", summary.states)}
        $${summary.nothingLeft ? TextRow({ children: html`Es ist kein Zeitfenster mehr möglich.`, padding: "0 0 16px 0", size: 18, color: COLOR.text, bold: true }) : ""}
        $${Button(BUTTON, email.terminUrl)}
        $${TextRow({ children: html`${CALENDAR_HINT}`, padding: "0 0 32px 0", size: 18, color: COLOR.muted })}
        $${Divider("0 0 24px 0")} $${Footer()}
      </table>
    </td>
  </tr>`;
}

const list = (items: string[]) => (items.length > 0 ? items.map((i) => `- ${i}`) : ["–"]);

function renderText(email: AnswerReceivedEmail, summary: ReturnType<typeof summarize>) {
  return [
    ...renderHeaderText(),
    "",
    summary.heading,
    "",
    `Aktenzeichen: ${email.overview.aktenzeichen}`,
    "",
    "Verfügbar:",
    ...list(summary.available),
    "",
    "Nicht verfügbar:",
    ...(summary.cancelled.length > 0 ? ["Diese Zeitfenster wurden abgesagt."] : []),
    ...list(summary.cancelled),
    "",
    "Aktueller Stand:",
    ...list(summary.states),
    ...(summary.nothingLeft ? ["", "Es ist kein Zeitfenster mehr möglich."] : []),
    "",
    `${BUTTON}:`,
    email.terminUrl,
    "",
    CALENDAR_HINT,
    "",
    "--",
    ...renderFooterText(),
    "",
  ].join("\n");
}

export function renderAnswerReceivedEmail(email: AnswerReceivedEmail) {
  const summary = summarize(email);
  const { overview, terminUrl, organizerEmail } = email;
  return {
    subject: SUBJECT,
    text: renderText(email, summary),
    html: Layout(
      { subject: SUBJECT, preheader: summary.heading },
      html`$${Header()} $${Divider("0 0 40px 0")} $${Content(email, summary)}`,
    ),
    attachments: [
      logoAttachment(),
      {
        filename: CALENDAR_FILENAME,
        content: createTerminCalendar({
          aktenzeichen: overview.aktenzeichen,
          terminUrl,
          organizerEmail,
          sequence: overview.calendarSequence,
          slots: overview.slots.map((slot) => ({
            id: slot.id,
            start: slot.start,
            end: slot.end,
            cancelled: isCancelled(slot),
            availableNames: availableNames(slot),
          })),
        }),
        contentType: TERMIN_CALENDAR_CONTENT_TYPE,
      },
    ],
  };
}
