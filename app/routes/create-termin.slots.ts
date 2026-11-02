import { toWallClock, wallClockToInstant } from "~/core/domain/time/berlin.server";
import type { TimeRange } from "~/core/domain/time/time-range";

import type { SlotInput } from "./create-termin.schema";

// Expects a slot that passed validation, which includes that its times exist in Berlin.
export function slotToRange(slot: SlotInput): TimeRange {
  const [year, month, day] = [slot.year, slot.month, slot.day].map(Number) as [
    number,
    number,
    number,
  ];
  return {
    start: wallClockToInstant({
      year,
      month,
      day,
      hour: Number(slot.startHour),
      minute: Number(slot.startMinute),
    }),
    end: wallClockToInstant({
      year,
      month,
      day,
      hour: Number(slot.endHour),
      minute: Number(slot.endMinute),
    }),
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

export function rangeToSlot({ start, end }: TimeRange): SlotInput {
  const from = toWallClock(start);
  const to = toWallClock(end);
  return {
    day: pad(from.day),
    month: pad(from.month),
    year: String(from.year),
    startHour: pad(from.hour),
    startMinute: pad(from.minute),
    endHour: pad(to.hour),
    endMinute: pad(to.minute),
  };
}
