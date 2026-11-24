import type { TimeOfDay } from "./time/time-of-day.ts";

// A regular court day of a judge: every week on this weekday, the hearings run from start to end,
// in Berlin wall-clock time. A judge can have several, also on the same weekday, but they must not
// overlap. The switch between summer and winter time happens on a Sunday night, so it never
// skips or repeats a time on a Sitzungstag.

// ISO weekdays, Monday (1) to Friday (5).
export const WEEKDAYS = [1, 2, 3, 4, 5] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const isWeekday = (value: number): value is Weekday =>
  (WEEKDAYS as readonly number[]).includes(value);

export type SitzungstagTimes = { weekday: Weekday; start: TimeOfDay; end: TimeOfDay };
export type Sitzungstag = SitzungstagTimes & { id: string };

// By weekday, then by start time.
export const compareSitzungstage = (a: SitzungstagTimes, b: SitzungstagTimes) =>
  a.weekday - b.weekday || a.start - b.start;

// Two on the same weekday overlap when one starts before the other ends. Days that only touch, one
// ending when the next starts, do not.
export const overlaps = (a: SitzungstagTimes, b: SitzungstagTimes) =>
  a.weekday === b.weekday && a.start < b.end && b.start < a.end;

// The first of the others that the given one overlaps, in the order of the list.
export function findOverlap<T extends SitzungstagTimes>(
  candidate: SitzungstagTimes,
  others: readonly T[],
): T | undefined {
  return [...others].sort(compareSitzungstage).find((other) => overlaps(candidate, other));
}
