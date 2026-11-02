import { describe, expect, it } from "vitest";

import { berlinDay } from "../time-zone";

describe("berlinDay", () => {
  it.each([
    // Summer time, UTC+2: Berlin is already on the next day from 22:00 UTC.
    ["2026-06-30T21:59:00Z", "2026-06-30"],
    ["2026-06-30T22:00:00Z", "2026-07-01"],
    ["2026-06-30T23:30:00Z", "2026-07-01"],
    // Winter time, UTC+1: from 23:00 UTC.
    ["2026-12-31T22:59:00Z", "2026-12-31"],
    ["2026-12-31T23:00:00Z", "2027-01-01"],
  ])("puts %s on %s", (instant, day) => {
    expect(berlinDay(new Date(instant))).toBe(day);
  });

  it("is not the UTC day shortly after midnight in Berlin", () => {
    // 00:30 in Berlin is 22:30 UTC the day before.
    expect(berlinDay(new Date("2026-09-17T22:30:00Z"))).toBe("2026-09-18");
  });

  it("pads month and day so that days sort as strings", () => {
    expect(berlinDay(new Date("2026-01-05T12:00:00Z"))).toBe("2026-01-05");
  });
});
