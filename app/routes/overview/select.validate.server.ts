import { isLongEnough, windowKey, type SlotWindow } from "~/core/domain/availability";
import { toWallClock, wallClockToInstant } from "~/core/domain/time/berlin.server";
import { formatTime } from "~/core/domain/time/format";
import type { TimeRange } from "~/core/domain/time/time-range";
import { checkWallClock } from "~/core/domain/time/wall-clock";

import { formatMinutes } from "../draft/schema";
import { messages, type SelectErrors, type SelectValues } from "./select.schema";

const parts = (value: string, pattern: RegExp, max: number) =>
  pattern.test(value) && Number(value) <= max ? Number(value) : null;

type Selection = { success: true; window: TimeRange } | { success: false; errors: SelectErrors };

// The judge picks one of the remaining windows and the time the appointment starts. The confirmed
// window then runs until the remaining window ends, so everyone who answered is available for all
// of it. It has to be long enough for the appointment.
export function validateSelection(
  values: SelectValues,
  remaining: SlotWindow[],
  minDurationMinutes: number | null = null,
): Selection {
  const chosen = remaining.find((window) => windowKey(window) === values.slot);
  if (!chosen) return { success: false, errors: { slot: messages.slot } };

  const hour = parts(values.hour.trim(), /^\d{1,2}$/, 23);
  const minute = parts(values.minute.trim(), /^\d{1,2}$/, 59);
  if (hour === null || minute === null)
    return { success: false, errors: { start: messages.start } };

  // The start is on the day the window starts, which is the day it ends on as well.
  const { year, month, day } = toWallClock(chosen.start);
  const wallClock = { year, month, day, hour, minute };
  if (checkWallClock(wallClock) !== "ok") {
    return { success: false, errors: { start: messages.notExactlyOnce } };
  }
  const start = wallClockToInstant(wallClock);
  if (start < chosen.start || start >= chosen.end) {
    return {
      success: false,
      errors: { start: messages.outside(formatTime(chosen.start), formatTime(chosen.end)) },
    };
  }
  const window = { start, end: chosen.end };
  if (minDurationMinutes !== null && !isLongEnough(window, minDurationMinutes)) {
    const latest = new Date(chosen.end.getTime() - minDurationMinutes * 60_000);
    return {
      success: false,
      errors: { start: messages.tooShort(formatTime(latest), formatMinutes(minDurationMinutes)) },
    };
  }
  return { success: true, window };
}
