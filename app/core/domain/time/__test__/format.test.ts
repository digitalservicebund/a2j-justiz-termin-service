import { describe, expect, it } from "vitest";

import {
  formatCalendarDate,
  formatDay,
  formatInstant,
  formatRange,
  formatRangeLong,
  formatSynchronizedAt,
  formatTime,
} from "../format";

// 15:30 to 18:00 Berlin time in September.
const range = {
  start: new Date("2026-09-17T13:30:00Z"),
  end: new Date("2026-09-17T16:00:00Z"),
};

describe("formatters", () => {
  it("show instants in German and Berlin time", () => {
    expect(formatDay(range.start)).toBe("17. September 2026");
    expect(formatTime(range.start)).toBe("15:30");
    expect(formatInstant(range.start)).toBe("Donnerstag, 17. September 2026 um 15:30");
  });

  it("move an instant just before midnight UTC to the next Berlin day", () => {
    const instant = new Date("2026-09-17T22:30:00Z");
    expect(formatDay(instant)).toBe("18. September 2026");
    expect(formatTime(instant)).toBe("00:30");
  });

  it("show winter and summer time", () => {
    expect(formatTime(new Date("2026-01-05T08:00:00Z"))).toBe("09:00");
    expect(formatTime(new Date("2026-09-17T07:00:00Z"))).toBe("09:00");
  });

  it("show the time of a synchronization with seconds and zone", () => {
    expect(formatSynchronizedAt(new Date("2026-09-17T07:00:05Z"))).toBe(
      "17. September 2026 um 09:00:05 MESZ",
    );
  });

  it("keep a calendar date on its day", () => {
    expect(formatCalendarDate(2026, 9, 17)).toBe("17. September 2026");
    expect(formatCalendarDate(2027, 1, 1)).toBe("1. Januar 2027");
  });
});

describe("formatRangeLong and formatRange", () => {
  it("name the day once for a range within a day", () => {
    expect(formatRangeLong(range)).toBe("17. September 2026 von 15:30 bis 18:00");
    expect(formatRange(range)).toBe("Donnerstag, 17.09.2026, 15:30 – 18:00 Uhr");
  });

  it("name both days when the range ends after midnight in Berlin", () => {
    // 23:00 to 01:00 Berlin time.
    const overMidnight = {
      start: new Date("2026-09-17T21:00:00Z"),
      end: new Date("2026-09-17T23:00:00Z"),
    };
    expect(formatRangeLong(overMidnight)).toBe(
      "17. September 2026 von 23:00 bis 18. September 2026, 01:00",
    );
    expect(formatRange(overMidnight)).toBe(
      "Donnerstag, 17.09.2026, 23:00 – Freitag, 18.09.2026, 01:00 Uhr",
    );
  });

  it("keep a range that ends at 23:59 Berlin time on one day, though its UTC end is the same day", () => {
    const lateEvening = {
      start: new Date("2026-12-31T21:00:00Z"),
      end: new Date("2026-12-31T22:59:00Z"),
    };
    expect(formatRangeLong(lateEvening)).toBe("31. Dezember 2026 von 22:00 bis 23:59");
  });
});
