import { TIME_ZONE } from "./time-zone.ts";

// Berlin wall-clock time, as people type it into a form.
export type WallClock = { year: number; month: number; day: number; hour: number; minute: number };

// A wall-clock time that is fine, one that the switch to summer time skips (02:30 on the last
// Sunday of March), or one that the switch back to winter time repeats (02:30 on the last Sunday
// of October).
export type WallClockKind = "ok" | "skipped" | "repeated";

const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

const HOUR = 60 * 60 * 1000;

function showsAs(instant: number, { year, month, day, hour, minute }: WallClock): boolean {
  const shown = Object.fromEntries(
    parts.formatToParts(instant).map(({ type, value }) => [type, Number(value)]),
  );
  return (
    shown.year === year &&
    shown.month === month &&
    shown.day === day &&
    shown.hour === hour &&
    shown.minute === minute
  );
}

// Berlin is one or two hours ahead of UTC, so the wall-clock time read as UTC lies one or two hours
// after the instant it names. Counting how many of the two instants show that wall-clock time tells
// whether it is skipped (none) or repeated (both). This uses Intl only, so the form can check
// times in the browser as well.
export function checkWallClock(wallClock: WallClock): WallClockKind {
  const { year, month, day, hour, minute } = wallClock;
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const matches = [asUtc - HOUR, asUtc - 2 * HOUR].filter((instant) => showsAs(instant, wallClock));
  if (matches.length === 0) return "skipped";
  return matches.length === 1 ? "ok" : "repeated";
}
