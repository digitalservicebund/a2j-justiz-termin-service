import { contains, isLongEnough, mergeWindows, type SlotWindow } from "~/core/domain/availability";
import { toWallClock, wallClockToInstant } from "~/core/domain/time/berlin.server";
import { formatTime } from "~/core/domain/time/format";
import { checkWallClock } from "~/core/domain/time/wall-clock";

import { messages as slotMessages } from "./create-termin.schema";

export const messages = {
  start: slotMessages.start,
  end: slotMessages.end,
  range: slotMessages.range,
  tooShort: slotMessages.tooShort,
  notExactlyOnce:
    "Diese Uhrzeit gibt es wegen der Zeitumstellung nicht oder zweimal. Wählen Sie eine andere.",
  outside: (from: string, to: string) =>
    `Das kleinere Zeitfenster muss zwischen ${from} und ${to} liegen.`,
};

export type WindowValues = {
  startHour: string;
  startMinute: string;
  endHour: string;
  endMinute: string;
};

export type WindowErrors = { start?: string; end?: string; range?: string };

type Result = { success: true; window: SlotWindow } | { success: false; errors: WindowErrors };

const fail = (range: string): Result => ({ success: false, errors: { range } });

const part = (value: string, max: number) =>
  /^\d{1,2}$/.test(value.trim()) && Number(value) <= max ? Number(value) : null;

// A time on the day of the offered window, or the reason it is none.
function readTime(offer: SlotWindow, hourValue: string, minuteValue: string, invalid: string) {
  const hour = part(hourValue, 23);
  const minute = part(minuteValue, 59);
  if (hour === null || minute === null) return { error: invalid };
  const { year, month, day } = toWallClock(offer.start);
  const wallClock = { year, month, day, hour, minute };
  if (checkWallClock(wallClock) !== "ok") return { error: messages.notExactlyOnce };
  return { instant: wallClockToInstant(wallClock) };
}

// A smaller availability window within the remaining window a guest was offered. It has to lie
// within the offer and be long enough for the appointment; the whole offer is fine as well, and
// then simply means "available". `others` are the guest's other windows in the offer: a window
// that overlaps or touches one of them becomes one with it, so only the two together have to be
// long enough.
export function validateSmallerWindow(
  values: WindowValues,
  offer: SlotWindow,
  minDurationMinutes: number | null,
  others: SlotWindow[] = [],
): Result {
  const start = readTime(offer, values.startHour, values.startMinute, messages.start);
  const end = readTime(offer, values.endHour, values.endMinute, messages.end);
  if (!start.instant || !end.instant) {
    return { success: false, errors: { start: start.error, end: end.error } };
  }

  const window = { slotId: offer.slotId, start: start.instant, end: end.instant };
  if (window.end <= window.start) return fail(messages.range);
  if (!contains(offer, window)) {
    return fail(messages.outside(formatTime(offer.start), formatTime(offer.end)));
  }
  const merged = mergeWindows([...others, window]).find((other) => contains(other, window));
  if (minDurationMinutes !== null && !isLongEnough(merged ?? window, minDurationMinutes)) {
    return fail(messages.tooShort(minDurationMinutes));
  }
  return { success: true, window };
}
