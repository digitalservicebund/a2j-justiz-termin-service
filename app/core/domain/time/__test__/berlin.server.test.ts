// @vitest-environment node
import { describe, expect, it } from "vitest";

import { toWallClock, wallClockToInstant } from "../berlin.server";
import { checkWallClock, type WallClock } from "../wall-clock";

const at = (year: number, month: number, day: number, hour: number, minute: number) => ({
  year,
  month,
  day,
  hour,
  minute,
});

describe("wallClockToInstant", () => {
  it("reads winter times as UTC+1 and summer times as UTC+2", () => {
    expect(wallClockToInstant(at(2026, 1, 5, 9, 0)).toISOString()).toBe("2026-01-05T08:00:00.000Z");
    expect(wallClockToInstant(at(2026, 9, 17, 9, 0)).toISOString()).toBe(
      "2026-09-17T07:00:00.000Z",
    );
  });

  it.each([
    [at(2026, 9, 17, 0, 0), "2026-09-16T22:00:00.000Z"],
    [at(2026, 9, 17, 0, 30), "2026-09-16T22:30:00.000Z"],
    [at(2026, 9, 17, 23, 59), "2026-09-17T21:59:00.000Z"],
    [at(2026, 12, 31, 0, 0), "2026-12-30T23:00:00.000Z"],
    [at(2026, 12, 31, 23, 59), "2026-12-31T22:59:00.000Z"],
  ])("handles times around midnight (%j)", (wallClock, iso) => {
    expect(wallClockToInstant(wallClock).toISOString()).toBe(iso);
  });

  it("uses the right offset on both sides of the change to summer time (2027-03-28)", () => {
    expect(wallClockToInstant(at(2027, 3, 28, 1, 59)).toISOString()).toBe(
      "2027-03-28T00:59:00.000Z",
    );
    expect(wallClockToInstant(at(2027, 3, 28, 3, 0)).toISOString()).toBe(
      "2027-03-28T01:00:00.000Z",
    );
  });

  it("uses the right offset on both sides of the change to winter time (2026-10-25)", () => {
    expect(wallClockToInstant(at(2026, 10, 25, 1, 59)).toISOString()).toBe(
      "2026-10-24T23:59:00.000Z",
    );
    expect(wallClockToInstant(at(2026, 10, 25, 3, 0)).toISOString()).toBe(
      "2026-10-25T02:00:00.000Z",
    );
  });

  it("refuses times that do not name exactly one instant", () => {
    expect(() => wallClockToInstant(at(2027, 3, 28, 2, 30))).toThrow(RangeError);
    expect(() => wallClockToInstant(at(2026, 10, 25, 2, 30))).toThrow(RangeError);
  });
});

describe("checkWallClock", () => {
  it("accepts ordinary times", () => {
    expect(checkWallClock(at(2026, 9, 17, 9, 0))).toBe("ok");
    expect(checkWallClock(at(2026, 9, 17, 0, 0))).toBe("ok");
    expect(checkWallClock(at(2026, 9, 17, 23, 59))).toBe("ok");
  });

  it("finds the hour that the change to summer time skips", () => {
    expect(checkWallClock(at(2027, 3, 28, 1, 59))).toBe("ok");
    expect(checkWallClock(at(2027, 3, 28, 2, 0))).toBe("skipped");
    expect(checkWallClock(at(2027, 3, 28, 2, 59))).toBe("skipped");
    expect(checkWallClock(at(2027, 3, 28, 3, 0))).toBe("ok");
  });

  it("finds the hour that the change to winter time repeats", () => {
    expect(checkWallClock(at(2026, 10, 25, 1, 59))).toBe("ok");
    expect(checkWallClock(at(2026, 10, 25, 2, 0))).toBe("repeated");
    expect(checkWallClock(at(2026, 10, 25, 2, 59))).toBe("repeated");
    expect(checkWallClock(at(2026, 10, 25, 3, 0))).toBe("ok");
  });
});

describe("toWallClock", () => {
  it("shows an instant as Berlin time, whatever the day in UTC is", () => {
    expect(toWallClock(new Date("2026-09-16T22:30:00Z"))).toEqual(at(2026, 9, 17, 0, 30));
    expect(toWallClock(new Date("2026-12-31T23:00:00Z"))).toEqual(at(2027, 1, 1, 0, 0));
  });

  it("round-trips with wallClockToInstant around midnight and the changes", () => {
    for (const wallClock of [
      at(2026, 9, 17, 0, 0),
      at(2026, 9, 17, 23, 59),
      at(2027, 3, 28, 3, 0),
      at(2026, 10, 25, 3, 0),
    ]) {
      expect(toWallClock(wallClockToInstant(wallClock))).toEqual(wallClock);
    }
  });
});

describe("checkWallClock and wallClockToInstant", () => {
  // The browser checks times with Intl and the server converts them with Temporal. They have to
  // agree on every minute of the days with a clock change, and on the days around them.
  it.each([
    [2026, 3, 29],
    [2026, 10, 25],
    [2027, 3, 28],
    [2027, 10, 31],
    [2026, 6, 15],
    [2026, 12, 31],
  ])("agree on every minute of %i-%i-%i", (year, month, day) => {
    const disagreements: WallClock[] = [];
    for (let minuteOfDay = 0; minuteOfDay < 24 * 60; minuteOfDay += 1) {
      const wallClock: WallClock = {
        year,
        month,
        day,
        hour: Math.floor(minuteOfDay / 60),
        minute: minuteOfDay % 60,
      };
      const converts = (() => {
        try {
          wallClockToInstant(wallClock);
          return true;
        } catch {
          return false;
        }
      })();
      if ((checkWallClock(wallClock) === "ok") !== converts) disagreements.push(wallClock);
    }
    expect(disagreements).toEqual([]);
  });
});
