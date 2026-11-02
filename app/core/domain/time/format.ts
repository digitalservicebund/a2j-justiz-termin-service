import type { TimeRange } from "./time-range.ts";
import { berlinDay, TIME_ZONE } from "./time-zone.ts";

// Everything shown to people is formatted here, in German and Berlin time. These use Intl only, so
// they also work in the browser.

const intl = (options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("de-DE", { timeZone: TIME_ZONE, ...options });

const dayLong = intl({ day: "numeric", month: "long", year: "numeric" });
const dayWithWeekdayLong = intl({
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const dayWithWeekdayNumeric = intl({
  weekday: "long",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});
const time = intl({ hour: "2-digit", minute: "2-digit" });
const synchronizedAt = intl({
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
  timeZoneName: "short",
});

// A calendar date has no time zone. It is formatted as UTC so that no offset can move it to
// another day.
const calendarDate = new Intl.DateTimeFormat("de-DE", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

// "17. September 2026"
export const formatDay = (instant: Date) => dayLong.format(instant);

// "09:00"
export const formatTime = (instant: Date) => time.format(instant);

// "Donnerstag, 17. September 2026 um 09:00"
export const formatInstant = (instant: Date) =>
  `${dayWithWeekdayLong.format(instant)} um ${time.format(instant)}`;

// "17. September 2026" for a date that is not tied to an instant, such as one typed into a form.
export const formatCalendarDate = (year: number, month: number, day: number) =>
  calendarDate.format(new Date(Date.UTC(year, month - 1, day)));

// "17. September 2026 um 09:00:00 MESZ"
export const formatSynchronizedAt = (instant: Date) => synchronizedAt.format(instant);

const endsOnAnotherDay = ({ start, end }: TimeRange) => berlinDay(start) !== berlinDay(end);

// "17. September 2026 von 15:30 bis 18:00". The end gets its own day when it falls on a later one.
export function formatRangeLong(range: TimeRange): string {
  const end = endsOnAnotherDay(range)
    ? `${formatDay(range.end)}, ${formatTime(range.end)}`
    : formatTime(range.end);
  return `${formatDay(range.start)} von ${formatTime(range.start)} bis ${end}`;
}

// "Donnerstag, 17.09.2026, 15:30 – 18:00 Uhr"
export function formatRange(range: TimeRange): string {
  const end = endsOnAnotherDay(range)
    ? `${dayWithWeekdayNumeric.format(range.end)}, ${time.format(range.end)}`
    : time.format(range.end);
  return `${dayWithWeekdayNumeric.format(range.start)}, ${time.format(range.start)} – ${end} Uhr`;
}
