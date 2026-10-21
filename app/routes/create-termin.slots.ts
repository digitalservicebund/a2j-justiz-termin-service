import type { SlotInput } from "./create-termin.schema";

const TIME_ZONE = "Europe/Berlin";

const wallClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

type WallClock = { year: number; month: number; day: number; hour: number; minute: number };

function berlinWallClock(instant: Date): WallClock {
  const parts = Object.fromEntries(
    wallClock.formatToParts(instant).map(({ type, value }) => [type, Number(value)]),
  );
  return {
    year: parts.year!,
    month: parts.month!,
    day: parts.day!,
    hour: parts.hour!,
    minute: parts.minute!,
  };
}

// How far Berlin wall-clock time is ahead of UTC at this instant, in milliseconds.
function berlinOffset(instant: Date): number {
  const { year, month, day, hour, minute } = berlinWallClock(instant);
  return Date.UTC(year, month - 1, day, hour, minute) - instant.getTime();
}

// Turns Berlin wall-clock time into an instant. Starting from the wall clock read as UTC, the
// offset is looked up twice so times near a daylight-saving change still land on the right side.
function berlinToInstant(year: number, month: number, day: number, hour: number, minute: number) {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  const first = asUtc - berlinOffset(new Date(asUtc));
  return new Date(asUtc - berlinOffset(new Date(first)));
}

export type SlotRange = { start: Date; end: Date };

// Expects a slot that passed validation.
export function slotToRange(slot: SlotInput): SlotRange {
  const [year, month, day] = [slot.year, slot.month, slot.day].map(Number) as [
    number,
    number,
    number,
  ];
  return {
    start: berlinToInstant(year, month, day, Number(slot.startHour), Number(slot.startMinute)),
    end: berlinToInstant(year, month, day, Number(slot.endHour), Number(slot.endMinute)),
  };
}

const pad = (value: number) => String(value).padStart(2, "0");

export function rangeToSlot({ start, end }: SlotRange): SlotInput {
  const from = berlinWallClock(start);
  const to = berlinWallClock(end);
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
