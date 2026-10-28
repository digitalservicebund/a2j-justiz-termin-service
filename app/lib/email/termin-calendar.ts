import type { AppointmentSlot } from "../../adapters/appointments/appointments.server.ts";
import { PRODUCT_NAME } from "./email-parts.ts";

type TerminCalendar = {
  aktenzeichen: string;
  slots: CalendarSlot[];
  // Where the judge opens the Termin to make changes or confirm a slot.
  terminUrl: string;
  // Raised with every re-issue, so clients replace an earlier version of the events.
  sequence: number;
  // Who the events come from: the address the mail is sent from. Outlook only shows the organizer
  // and accepts later updates from an organizer it can identify by e-mail address.
  organizerEmail: string;
  now?: Date;
};

export type CalendarSlot = AppointmentSlot & {
  // A slot someone cannot attend. Its event is cancelled.
  cancelled?: boolean;
  // Who said they are available. Left out while nobody has answered yet.
  availableNames?: string[];
};

const toUtcStamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");

// RFC 5545 section 3.3.11: escape backslash, semicolon and comma, and write line breaks as \n.
const escapeText = (value: string) =>
  value.replace(/[;,]/g, (character) => `\\${character}`).replace(/\r?\n/g, "\\n");

// RFC 5545 section 3.1: lines are at most 75 octets, continued on the next line after a space.
// Splitting by code point keeps multi-byte characters in one piece.
function fold(line: string): string[] {
  const lines: string[] = [];
  let current = "";
  let size = 0;
  for (const character of line) {
    const width = Buffer.byteLength(character);
    // A continuation line starts with the space, which counts towards its 75 octets.
    if (size + width > 75) {
      lines.push(current);
      current = " ";
      size = 1;
    }
    current += character;
    size += width;
  }
  lines.push(current);
  return lines;
}

export const TERMIN_CALENDAR_CONTENT_TYPE = "text/calendar; charset=utf-8; method=PUBLISH";

// One tentative event per proposed time slot, so the judge's calendar shows them as busy until a
// slot is confirmed. Times are UTC, which spares the calendar a time zone definition.
function describe(
  { cancelled, availableNames }: CalendarSlot,
  aktenzeichen: string,
  terminUrl: string,
) {
  const link = `Termin öffnen, ändern oder bestätigen: ${terminUrl}`;
  if (cancelled) {
    return [
      `Abgesagt: Mindestens ein Verfahrensbeteiligter ist für die Verhandlung ${aktenzeichen} in diesem Zeitraum nicht verfügbar.`,
      "",
      link,
    ].join("\n");
  }
  return [
    `Vorläufiger Zeitraum für die Verhandlung ${aktenzeichen}.`,
    ...(availableNames
      ? [`Verfügbar: ${availableNames.length > 0 ? availableNames.join(", ") : "–"}`]
      : []),
    "Wir warten auf die Rückmeldungen der Verfahrensbeteiligten.",
    "",
    link,
  ].join("\n");
}

// One event per proposed time slot. Open slots are tentative, so the judge's calendar shows them as
// busy until a slot is confirmed; slots someone cannot attend are cancelled. Times are UTC, which
// spares the calendar a time zone definition.
export function createTerminCalendar({
  aktenzeichen,
  slots,
  terminUrl,
  sequence,
  organizerEmail,
  now = new Date(),
}: TerminCalendar): string {
  const stamp = toUtcStamp(now);
  const organizer = `ORGANIZER;CN="${PRODUCT_NAME}":mailto:${organizerEmail}`;

  // The UID is the id of the time slot, not its time, so a moved slot updates its event. The prefix
  // shows in the calendar data what the id belongs to.
  const events = slots.flatMap((slot) => [
    "BEGIN:VEVENT",
    `UID:timeslot-${slot.id}`,
    `SEQUENCE:${sequence}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toUtcStamp(slot.start)}`,
    `DTEND:${toUtcStamp(slot.end)}`,
    `SUMMARY:${escapeText(`${slot.cancelled ? "Abgesagt" : "Vorläufig"}: Verhandlung ${aktenzeichen}`)}`,
    `DESCRIPTION:${escapeText(describe(slot, aktenzeichen, terminUrl))}`,
    organizer,
    `URL:${terminUrl}`,
    `STATUS:${slot.cancelled ? "CANCELLED" : "TENTATIVE"}`,
    // A cancelled slot no longer blocks the judge's calendar. Outlook shows availability from its
    // own property, not from TRANSP.
    `TRANSP:${slot.cancelled ? "TRANSPARENT" : "OPAQUE"}`,
    `X-MICROSOFT-CDO-BUSYSTATUS:${slot.cancelled ? "FREE" : "TENTATIVE"}`,
    "END:VEVENT",
  ]);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Justiz Termin Service//Terminumfrage//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...events,
    "END:VCALENDAR",
  ]
    .flatMap(fold)
    .concat("")
    .join("\r\n");
}
