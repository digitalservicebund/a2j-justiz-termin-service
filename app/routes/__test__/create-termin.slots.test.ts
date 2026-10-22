import { describe, expect, it } from "vitest";

import { emptySlot, type SlotInput } from "../create-termin.schema";
import { rangeToSlot, slotToRange } from "../create-termin.slots";

const slot = (date: [string, string, string], start: [string, string], end: [string, string]) => ({
  ...emptySlot,
  day: date[0],
  month: date[1],
  year: date[2],
  startHour: start[0],
  startMinute: start[1],
  endHour: end[0],
  endMinute: end[1],
});

describe("slotToRange", () => {
  it("reads the times as Berlin winter time (UTC+1)", () => {
    const range = slotToRange(slot(["5", "1", "2099"], ["9", "0"], ["10", "30"]));
    expect(range.start.toISOString()).toBe("2099-01-05T08:00:00.000Z");
    expect(range.end.toISOString()).toBe("2099-01-05T09:30:00.000Z");
  });

  it("reads the times as Berlin summer time (UTC+2)", () => {
    const range = slotToRange(slot(["17", "9", "2026"], ["9", "0"], ["10", "30"]));
    expect(range.start.toISOString()).toBe("2026-09-17T07:00:00.000Z");
    expect(range.end.toISOString()).toBe("2026-09-17T08:30:00.000Z");
  });

  it("switches offset on the days clocks change", () => {
    // 2026: clocks go forward on 29 March (02:00 to 03:00) and back on 25 October (03:00 to 02:00).
    expect(
      slotToRange(slot(["29", "3", "2026"], ["1", "0"], ["1", "30"])).start.toISOString(),
    ).toBe("2026-03-29T00:00:00.000Z");
    expect(slotToRange(slot(["29", "3", "2026"], ["4", "0"], ["5", "0"])).start.toISOString()).toBe(
      "2026-03-29T02:00:00.000Z",
    );
    expect(
      slotToRange(slot(["25", "10", "2026"], ["1", "0"], ["1", "30"])).start.toISOString(),
    ).toBe("2026-10-24T23:00:00.000Z");
    expect(
      slotToRange(slot(["25", "10", "2026"], ["4", "0"], ["5", "0"])).start.toISOString(),
    ).toBe("2026-10-25T03:00:00.000Z");
  });
});

describe("rangeToSlot", () => {
  it("returns padded Berlin wall-clock fields", () => {
    expect(
      rangeToSlot({
        start: new Date("2026-09-07T07:05:00Z"),
        end: new Date("2026-09-07T08:00:00Z"),
      }),
    ).toEqual(slot(["07", "09", "2026"], ["09", "05"], ["10", "00"]));
  });

  it("round-trips with slotToRange, also around midnight", () => {
    const original: SlotInput = slot(["25", "12", "2099"], ["23", "30"], ["23", "59"]);
    expect(rangeToSlot(slotToRange(original))).toEqual({
      ...original,
      startHour: "23",
      startMinute: "30",
      endHour: "23",
      endMinute: "59",
    });
  });
});
