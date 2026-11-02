import { TIME_ZONE } from "./time-zone.ts";
import type { WallClock } from "./wall-clock.ts";

// Conversion between Berlin wall-clock time and instants. Uses Temporal, so it must only run on the
// server. Whether a wall-clock time exists exactly once is checked with checkWallClock first.

const parts = ({ year, month, day, hour, minute }: WallClock): WallClock => ({
  year,
  month,
  day,
  hour,
  minute,
});

export function toWallClock(instant: Date): WallClock {
  return parts(
    Temporal.Instant.fromEpochMilliseconds(instant.getTime()).toZonedDateTimeISO(TIME_ZONE),
  );
}

// Expects a wall-clock time that passed checkWallClock. Throws for one that is skipped or repeated
// instead of quietly picking one of the instants.
export function wallClockToInstant(wallClock: WallClock): Date {
  const zoned = Temporal.PlainDateTime.from(parts(wallClock)).toZonedDateTime(TIME_ZONE, {
    disambiguation: "reject",
  });
  return new Date(zoned.epochMilliseconds);
}
