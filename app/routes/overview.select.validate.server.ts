import { toWallClock, wallClockToInstant } from "~/core/domain/time/berlin.server";
import { formatTime } from "~/core/domain/time/format";
import type { TimeRange } from "~/core/domain/time/time-range";
import { checkWallClock } from "~/core/domain/time/wall-clock";

import { messages, type SelectErrors, type SelectValues } from "./overview.select.schema";

const parts = (value: string, pattern: RegExp, max: number) =>
  pattern.test(value) && Number(value) <= max ? Number(value) : null;

type Selection = { success: true; window: TimeRange } | { success: false; errors: SelectErrors };

// The judge picks one of the slots and the time it starts. The window then runs until the slot
// ends, so it can only become shorter than the slot, never longer.
export function validateSelection(values: SelectValues, slots: TimeRange[]): Selection {
  const slot = /^\d+$/.test(values.slot) ? slots[Number(values.slot)] : undefined;
  if (!slot) return { success: false, errors: { slot: messages.slot } };

  const hour = parts(values.hour.trim(), /^\d{1,2}$/, 23);
  const minute = parts(values.minute.trim(), /^\d{1,2}$/, 59);
  if (hour === null || minute === null)
    return { success: false, errors: { start: messages.start } };

  // The start is on the day the slot starts, which is the day it ends on as well.
  const { year, month, day } = toWallClock(slot.start);
  const wallClock = { year, month, day, hour, minute };
  if (checkWallClock(wallClock) !== "ok") {
    return { success: false, errors: { start: messages.notExactlyOnce } };
  }
  const start = wallClockToInstant(wallClock);
  if (start < slot.start || start >= slot.end) {
    return {
      success: false,
      errors: { start: messages.outside(formatTime(slot.start), formatTime(slot.end)) },
    };
  }
  return { success: true, window: { start, end: slot.end } };
}
