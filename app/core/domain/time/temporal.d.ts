// Node ships Temporal, but TypeScript 5.9 has no typings for it yet. This declares only the part
// the time module uses. Delete it once the TypeScript lib provides the real types.
declare namespace Temporal {
  type DateTimeFields = { year: number; month: number; day: number; hour: number; minute: number };

  type ZonedDateTime = {
    readonly epochMilliseconds: number;
  } & DateTimeFields;

  type PlainDateTime = {
    toZonedDateTime(
      timeZone: string,
      options?: { disambiguation?: "compatible" | "earlier" | "later" | "reject" },
    ): ZonedDateTime;
  } & DateTimeFields;

  const PlainDateTime: {
    from(fields: DateTimeFields): PlainDateTime;
  };

  type Instant = {
    toZonedDateTimeISO(timeZone: string): ZonedDateTime;
  };

  const Instant: {
    fromEpochMilliseconds(epochMilliseconds: number): Instant;
  };
}
