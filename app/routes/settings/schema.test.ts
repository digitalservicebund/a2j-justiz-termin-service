import { describe, expect, it } from "vitest";

import {
  describeSitzungstag,
  emptySitzungstag,
  messages,
  parseSitzungstagForm,
  toSitzungstagInput,
  validateSitzungstag,
} from "./schema";

const input = (overrides: Partial<typeof emptySitzungstag> = {}) => ({
  weekday: "2",
  startHour: "09",
  startMinute: "00",
  endHour: "12",
  endMinute: "30",
  ...overrides,
});

describe("parseSitzungstagForm", () => {
  it("reads the fields, trimmed, and leaves missing ones empty", () => {
    const form = new FormData();
    form.set("weekday", "3");
    form.set("startHour", " 8 ");
    expect(parseSitzungstagForm(form)).toEqual({
      ...emptySitzungstag,
      weekday: "3",
      startHour: "8",
    });
  });
});

describe("toSitzungstagInput", () => {
  it("shows a saved Sitzungstag with two-digit times", () => {
    expect(toSitzungstagInput({ weekday: 4, start: 9 * 60, end: 16 * 60 + 5 })).toEqual({
      weekday: "4",
      startHour: "09",
      startMinute: "00",
      endHour: "16",
      endMinute: "05",
    });
  });
});

describe("describeSitzungstag", () => {
  it("names the weekday and the times", () => {
    expect(describeSitzungstag({ weekday: 2, start: 9 * 60, end: 12 * 60 })).toBe(
      "Dienstag, 09:00 bis 12:00",
    );
  });
});

describe("validateSitzungstag", () => {
  it("accepts a weekday with an end after the start", () => {
    expect(validateSitzungstag(input(), [])).toEqual({
      success: true,
      times: { weekday: 2, start: 9 * 60, end: 12 * 60 + 30 },
    });
  });

  it("asks for a weekday when none or one outside Monday to Friday is chosen", () => {
    for (const weekday of ["", "0", "6", "7", "x", "12"]) {
      expect(validateSitzungstag(input({ weekday }), [])).toEqual({
        success: false,
        errors: { weekday: messages.weekday },
      });
    }
  });

  it("requires every time field", () => {
    expect(validateSitzungstag(input({ startMinute: "" }), [])).toEqual({
      success: false,
      errors: { start: messages.start },
    });
    expect(validateSitzungstag(input({ endHour: "" }), [])).toEqual({
      success: false,
      errors: { end: messages.end },
    });
  });

  it("rejects times that are not on a clock", () => {
    expect(validateSitzungstag(input({ startHour: "24" }), [])).toEqual({
      success: false,
      errors: { start: messages.start },
    });
    expect(validateSitzungstag(input({ endMinute: "60" }), [])).toEqual({
      success: false,
      errors: { end: messages.end },
    });
  });

  it("requires the end after the start, so a Sitzungstag cannot run past midnight", () => {
    for (const end of [
      { endHour: "09", endMinute: "00" },
      { endHour: "08", endMinute: "00" },
    ]) {
      expect(validateSitzungstag(input(end), [])).toEqual({
        success: false,
        errors: { range: messages.range },
      });
    }
  });

  it("reports every problem of the form at once", () => {
    expect(validateSitzungstag({ ...emptySitzungstag }, [])).toEqual({
      success: false,
      errors: { weekday: messages.weekday, start: messages.start, end: messages.end },
    });
  });

  it("rejects an overlap with another Sitzungstag on the same weekday and names it", () => {
    const others = [{ weekday: 2 as const, start: 11 * 60, end: 14 * 60 }];
    expect(validateSitzungstag(input(), others)).toEqual({
      success: false,
      errors: { overlap: messages.overlap("Dienstag, 11:00 bis 14:00") },
    });
    expect(messages.overlap("Dienstag, 11:00 bis 14:00")).toBe(
      "Dieser Sitzungstag überschneidet sich mit Dienstag, 11:00 bis 14:00.",
    );
  });

  it("accepts several on the same weekday that only touch, and the same times on another day", () => {
    const others = [
      { weekday: 2 as const, start: 12 * 60 + 30, end: 17 * 60 },
      { weekday: 3 as const, start: 9 * 60, end: 12 * 60 + 30 },
    ];
    expect(validateSitzungstag(input(), others).success).toBe(true);
  });
});
