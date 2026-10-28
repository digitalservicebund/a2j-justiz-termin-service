import type { AppointmentSlot } from "../../adapters/appointments/appointments.server.ts";

type TerminCalendar = {
  aktenzeichen: string;
  slots: AppointmentSlot[];
  // Where the judge opens the Termin to make changes or confirm a slot.
  terminUrl: string;
  // Changes when the calendar is re-issued, so clients replace an earlier version.
  now?: Date;
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
export function createTerminCalendar({
  aktenzeichen,
  slots,
  terminUrl,
  now = new Date(),
}: TerminCalendar): string {
  const stamp = toUtcStamp(now);
  const description = [
    `Vorläufiger Zeitraum für die Verhandlung ${aktenzeichen}.`,
    "Wir warten auf die Rückmeldungen der Verfahrensbeteiligten.",
    "",
    `Termin öffnen, ändern oder bestätigen: ${terminUrl}`,
  ].join("\n");

  // The UID is the id of the time slot, not its time, so a moved slot updates its event. The prefix
  // shows in the calendar data what the id belongs to.
  const events = slots.flatMap(({ id, start, end }) => [
    "BEGIN:VEVENT",
    `UID:timeslot-${id}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${toUtcStamp(start)}`,
    `DTEND:${toUtcStamp(end)}`,
    `SUMMARY:${escapeText(`Vorläufig: Verhandlung ${aktenzeichen}`)}`,
    `DESCRIPTION:${escapeText(description)}`,
    `URL:${terminUrl}`,
    "STATUS:TENTATIVE",
    "TRANSP:OPAQUE",
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
