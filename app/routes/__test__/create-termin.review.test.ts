import { describe, expect, it } from "vitest";

import { groupSlotsByDay } from "../create-termin.review";
import { emptySlot, type SlotInput } from "../create-termin.schema";

const slot = (day: string, month: string, start: [string, string], end: [string, string]) => ({
  ...emptySlot,
  day,
  month,
  year: "2026",
  startHour: start[0],
  startMinute: start[1],
  endHour: end[0],
  endMinute: end[1],
});

describe("groupSlotsByDay", () => {
  it("formats the date in German and pads the times", () => {
    expect(groupSlotsByDay([slot("7", "9", ["9", "5"], ["10", "0"])])).toEqual([
      { key: "2026-09-07", label: "7. September 2026", times: ["09:05 – 10:00"] },
    ]);
  });

  it("sorts days chronologically and windows by start time", () => {
    const days = groupSlotsByDay([
      slot("21", "9", ["15", "30"], ["16", "0"]),
      slot("17", "9", ["10", "0"], ["11", "0"]),
      slot("21", "9", ["9", "0"], ["10", "0"]),
      slot("3", "10", ["8", "0"], ["9", "0"]),
    ]);

    expect(days.map(({ label, times }) => [label, times])).toEqual([
      ["17. September 2026", ["10:00 – 11:00"]],
      ["21. September 2026", ["09:00 – 10:00", "15:30 – 16:00"]],
      ["3. Oktober 2026", ["08:00 – 09:00"]],
    ]);
  });

  it("ignores empty rows", () => {
    const slots: SlotInput[] = [emptySlot, slot("1", "9", ["9", "0"], ["10", "0"])];
    expect(groupSlotsByDay(slots)).toHaveLength(1);
    expect(groupSlotsByDay([emptySlot])).toEqual([]);
  });
});
