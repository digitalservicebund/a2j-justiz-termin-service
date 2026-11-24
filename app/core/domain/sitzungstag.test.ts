import { describe, expect, it } from "vitest";

import { compareSitzungstage, findOverlap, isWeekday, overlaps, WEEKDAYS } from "./sitzungstag.ts";

const at = (hour: number) => hour * 60;
const day = (weekday: 1 | 2 | 3 | 4 | 5, start: number, end: number, id = "x") => ({
  id,
  weekday,
  start: at(start),
  end: at(end),
});

describe("weekdays", () => {
  it("are Monday to Friday", () => {
    expect(WEEKDAYS).toEqual([1, 2, 3, 4, 5]);
    expect(isWeekday(1)).toBe(true);
    expect(isWeekday(5)).toBe(true);
    expect(isWeekday(0)).toBe(false);
    expect(isWeekday(6)).toBe(false);
    expect(isWeekday(7)).toBe(false);
  });
});

describe("overlaps", () => {
  it("is true when two on the same weekday share some time", () => {
    expect(overlaps(day(2, 9, 12), day(2, 11, 14))).toBe(true);
    expect(overlaps(day(2, 9, 17), day(2, 10, 11))).toBe(true);
    expect(overlaps(day(2, 9, 12), day(2, 9, 12))).toBe(true);
  });

  it("is false when they only touch", () => {
    expect(overlaps(day(2, 9, 12), day(2, 12, 14))).toBe(false);
    expect(overlaps(day(2, 12, 14), day(2, 9, 12))).toBe(false);
  });

  it("is false on different weekdays", () => {
    expect(overlaps(day(2, 9, 12), day(3, 9, 12))).toBe(false);
  });
});

describe("findOverlap", () => {
  it("finds the earliest one that overlaps", () => {
    const others = [day(2, 13, 15, "late"), day(2, 8, 10, "early"), day(4, 9, 17, "other")];
    expect(findOverlap(day(2, 9, 14), others)?.id).toBe("early");
  });

  it("finds none when nothing overlaps", () => {
    expect(findOverlap(day(2, 9, 12), [day(2, 12, 14), day(3, 9, 12)])).toBeUndefined();
    expect(findOverlap(day(2, 9, 12), [])).toBeUndefined();
  });
});

describe("compareSitzungstage", () => {
  it("sorts by weekday, then by start", () => {
    const sorted = [
      day(4, 9, 16, "d"),
      day(2, 14, 17, "b2"),
      day(2, 9, 12, "b1"),
      day(1, 9, 10, "a"),
    ]
      .sort(compareSitzungstage)
      .map(({ id }) => id);
    expect(sorted).toEqual(["a", "b1", "b2", "d"]);
  });
});
