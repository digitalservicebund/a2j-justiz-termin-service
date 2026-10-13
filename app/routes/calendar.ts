import type { LoaderFunctionArgs } from "react-router";

const calendar = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "PRODID:-//Justiz Termin Service//Mock Calendar//EN",
  "CALSCALE:GREGORIAN",
  "BEGIN:VTIMEZONE",
  "TZID:Europe/Berlin",
  "BEGIN:DAYLIGHT",
  "DTSTART:19960331T020000",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0200",
  "TZNAME:CEST",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "DTSTART:19961027T030000",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0100",
  "TZNAME:CET",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
  "BEGIN:VEVENT",
  "UID:test-termin@justiz-termin-service.invalid",
  "DTSTAMP:20261013T000000Z",
  "CREATED:20261013T000000Z",
  "DTSTART;TZID=Europe/Berlin:20261013T131500",
  "DTEND;TZID=Europe/Berlin:20261013T141500",
  "RRULE:FREQ=WEEKLY;BYDAY=TU",
  "SUMMARY:Test Termin",
  "END:VEVENT",
  "END:VCALENDAR",
  "",
].join("\r\n");

export function loader({ params }: LoaderFunctionArgs): Response {
  if (!params.calendarId) {
    throw new Response("Not Found", { status: 404 });
  }

  console.log(params.calendarId);

  return new Response(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
