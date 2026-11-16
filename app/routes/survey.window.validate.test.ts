import { describe, expect, it } from "vitest";

import { messages, validateSmallerWindow } from "./survey.window.validate.server";

// 14:00 to 17:00 Berlin time on 24 September 2026 is 12:00 to 15:00 UTC.
const offer = {
  slotId: "s1",
  start: new Date("2026-09-24T12:00:00Z"),
  end: new Date("2026-09-24T15:00:00Z"),
};

const enter = (start: string, end: string, minDurationMinutes: number | null = 90) => {
  const [startHour = "", startMinute = ""] = start.split(":");
  const [endHour = "", endMinute = ""] = end.split(":");
  return validateSmallerWindow(
    { startHour, startMinute, endHour, endMinute },
    offer,
    minDurationMinutes,
  );
};

describe("validateSmallerWindow", () => {
  it("accepts a window within the offered one, on its day and in its slot", () => {
    expect(enter("15:30", "17:00")).toEqual({
      success: true,
      window: {
        slotId: "s1",
        start: new Date("2026-09-24T13:30:00Z"),
        end: new Date("2026-09-24T15:00:00Z"),
      },
    });
  });

  it("accepts the whole offered window and single-digit times", () => {
    expect(enter("14:0", "17:0")).toEqual({ success: true, window: offer });
  });

  it("accepts any minute", () => {
    expect(enter("14:07", "15:37")).toMatchObject({ success: true });
  });

  it("rejects times that are missing, not numbers or not on the clock", () => {
    for (const time of [":", "15:", ":30", "ab:30", "15:3x", "24:00", "15:60", "-1:00"]) {
      expect(enter(time, "17:00")).toEqual({ success: false, errors: { start: messages.start } });
      expect(enter("14:00", time)).toEqual({ success: false, errors: { end: messages.end } });
    }
    expect(enter(":", ":")).toEqual({
      success: false,
      errors: { start: messages.start, end: messages.end },
    });
  });

  it("rejects an end that is not after the start", () => {
    for (const end of ["15:30", "15:00"]) {
      expect(enter("15:30", end)).toEqual({ success: false, errors: { range: messages.range } });
    }
  });

  it("rejects a window that reaches beyond the offered one", () => {
    for (const [start, end] of [
      ["13:59", "17:00"],
      ["14:00", "17:01"],
      ["09:00", "11:00"],
    ] as const) {
      expect(enter(start, end)).toEqual({
        success: false,
        errors: { range: messages.outside("14:00", "17:00") },
      });
    }
  });

  it("rejects a window shorter than the minimum duration", () => {
    expect(enter("15:00", "16:30").success).toBe(true);
    expect(enter("15:00", "16:29")).toEqual({
      success: false,
      errors: { range: messages.tooShort(90) },
    });
  });

  it("accepts any length without a minimum duration", () => {
    expect(enter("15:00", "15:01", null).success).toBe(true);
  });

  it("rejects a time the clock change repeats", () => {
    // 01:00 to 04:00 Berlin time on 25 October 2026, when 02:00 to 03:00 comes twice.
    const clockChange = {
      slotId: "s1",
      start: new Date("2026-10-24T23:00:00Z"),
      end: new Date("2026-10-25T03:00:00Z"),
    };
    const values = { startHour: "2", startMinute: "30", endHour: "4", endMinute: "0" };
    expect(validateSmallerWindow(values, clockChange, null)).toEqual({
      success: false,
      errors: { start: messages.notExactlyOnce },
    });
  });
});
