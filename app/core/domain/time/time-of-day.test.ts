import { describe, expect, it } from "vitest";

import { fromSqlTime, hourOf, minuteOf, parseTimeOfDay, toSqlTime } from "./time-of-day.ts";

describe("parseTimeOfDay", () => {
  it("reads an hour and a minute as minutes since midnight", () => {
    expect(parseTimeOfDay("09", "30")).toBe(570);
    expect(parseTimeOfDay("9", "5")).toBe(545);
    expect(parseTimeOfDay("0", "0")).toBe(0);
    expect(parseTimeOfDay("23", "59")).toBe(23 * 60 + 59);
  });

  it.each([
    ["24", "00"],
    ["12", "60"],
    ["", "00"],
    ["12", ""],
    ["-1", "00"],
    ["1.5", "00"],
    ["abc", "00"],
    ["123", "00"],
  ])("rejects %j:%j", (hour, minute) => {
    expect(parseTimeOfDay(hour, minute)).toBeNull();
  });
});

describe("SQL time", () => {
  it("writes a time of day as Postgres takes it", () => {
    expect(toSqlTime(570)).toBe("09:30");
    expect(toSqlTime(0)).toBe("00:00");
  });

  it("reads a time column as Postgres returns it", () => {
    expect(fromSqlTime("09:30:00")).toBe(570);
    expect(fromSqlTime("17:05")).toBe(17 * 60 + 5);
  });

  it("reads back what it writes", () => {
    for (const time of [0, 1, 570, 23 * 60 + 59]) expect(fromSqlTime(toSqlTime(time))).toBe(time);
  });

  it("refuses anything that is not a time", () => {
    expect(() => fromSqlTime("9:30")).toThrow("Not a time of day: 9:30");
    expect(() => fromSqlTime("09:30+01")).toThrow("Not a time of day: 09:30+01");
  });

  it("splits a time of day into hour and minute", () => {
    expect(hourOf(570)).toBe(9);
    expect(minuteOf(570)).toBe(30);
  });
});
