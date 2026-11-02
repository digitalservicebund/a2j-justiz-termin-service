import { describe, expect, it } from "vitest";

import { confirmedWindow, rowToRange } from "../time-range";

describe("rowToRange", () => {
  it("reads dates and strings alike", () => {
    expect(
      rowToRange({
        start_time: new Date("2026-09-17T07:00:00Z"),
        end_time: "2026-09-17T09:00:00Z",
      }),
    ).toEqual({
      start: new Date("2026-09-17T07:00:00Z"),
      end: new Date("2026-09-17T09:00:00Z"),
    });
  });

  it("gives a slot without an end no length", () => {
    expect(rowToRange({ start_time: "2026-09-17T07:00:00Z", end_time: null })).toEqual({
      start: new Date("2026-09-17T07:00:00Z"),
      end: new Date("2026-09-17T07:00:00Z"),
    });
  });
});

describe("confirmedWindow", () => {
  it("is the chosen window", () => {
    expect(
      confirmedWindow({
        confirmed_start_time: "2026-09-17T08:00:00Z",
        confirmed_end_time: new Date("2026-09-17T09:00:00Z"),
      }),
    ).toEqual({
      start: new Date("2026-09-17T08:00:00Z"),
      end: new Date("2026-09-17T09:00:00Z"),
    });
  });

  it.each([
    [null, null],
    ["2026-09-17T08:00:00Z", null],
    [null, "2026-09-17T09:00:00Z"],
  ])("is nothing without both ends (%j, %j)", (start, end) => {
    expect(confirmedWindow({ confirmed_start_time: start, confirmed_end_time: end })).toBeNull();
  });
});
