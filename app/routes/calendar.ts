import type { LoaderFunctionArgs } from "react-router";

function createCalendar(synchronizedAt: Date): string {
  const isoTimestamp = synchronizedAt.toISOString();
  const calendarTimestamp = isoTimestamp.replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const readableTimestamp = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
    timeZoneName: "short",
  }).format(synchronizedAt);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Justiz Termin Service//Mock Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "NAME:JTS Demo",
    "X-WR-CALNAME:JTS Demo",
    "DESCRIPTION:Public mock calendar for Justiz Termin Service.",
    "X-WR-CALDESC:Public mock calendar for Justiz Termin Service.",
    "COLOR:midnightblue",
    "REFRESH-INTERVAL;VALUE=DURATION:PT5M",
    "X-PUBLISHED-TTL:PT5M",
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
    `DTSTAMP:${calendarTimestamp}`,
    `LAST-MODIFIED:${calendarTimestamp}`,
    "CREATED:20261013T000000Z",
    "DTSTART;TZID=Europe/Berlin:20261013T132000",
    "DTEND;TZID=Europe/Berlin:20261013T142000",
    "RRULE:FREQ=WEEKLY;BYDAY=TU",
    "SUMMARY:Test Termin",
    "DESCRIPTION:Last synchronized (feed generated):\\n",
    ` ${readableTimestamp}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

export function loader({ params }: LoaderFunctionArgs): Response {
  if (!params.calendarId) {
    throw new Response("Not Found", { status: 404 });
  }

  console.log(params.calendarId);

  return new Response(createCalendar(new Date()), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8; method=PUBLISH",
      "Cache-Control": "no-store",
    },
  });
}
