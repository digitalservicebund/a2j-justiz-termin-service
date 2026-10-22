import { describe, expect, it } from "vitest";

import {
  describeSlot,
  messages,
  readValues,
  selectionSearch,
  validateSelection,
} from "../overview.select.schema";

// 15:30 to 18:00 and 09:00 to 13:00 Berlin time in September are 13:30 to 16:00 and 07:00 to 11:00 UTC.
const slots = [
  { start: new Date("2026-09-17T13:30:00Z"), end: new Date("2026-09-17T16:00:00Z") },
  { start: new Date("2026-09-21T07:00:00Z"), end: new Date("2026-09-21T11:00:00Z") },
];

const pick = (slot: string, hour: string, minute: string) =>
  validateSelection({ slot, hour, minute }, slots);

describe("describeSlot", () => {
  it("names the date and the time window in German", () => {
    expect(describeSlot(slots[0]!)).toBe("17. September 2026 von 15:30 bis 18:00");
    expect(describeSlot(slots[1]!)).toBe("21. September 2026 von 09:00 bis 13:00");
  });
});

describe("validateSelection", () => {
  it("runs the window from the start time to the end of the chosen slot", () => {
    expect(pick("0", "16", "45")).toEqual({
      success: true,
      window: { start: new Date("2026-09-17T14:45:00Z"), end: slots[0]!.end },
    });
  });

  it("accepts the start of the slot and single-digit times", () => {
    expect(pick("1", "9", "0")).toEqual({
      success: true,
      window: { start: slots[1]!.start, end: slots[1]!.end },
    });
  });

  it("asks for a slot when none or an unknown one is chosen", () => {
    for (const slot of ["", "2", "-1", "x", "0.5"]) {
      expect(pick(slot, "16", "0")).toEqual({ success: false, errors: { slot: messages.slot } });
    }
  });

  it("rejects times that are missing, not numbers or not on the clock", () => {
    for (const [hour, minute] of [
      ["", ""],
      ["16", ""],
      ["", "30"],
      ["ab", "30"],
      ["16", "3x"],
      ["24", "0"],
      ["16", "60"],
      ["-1", "0"],
      ["123", "0"],
    ] as const) {
      expect(pick("0", hour, minute)).toEqual({
        success: false,
        errors: { start: messages.start },
      });
    }
  });

  it("rejects a start before the slot begins", () => {
    expect(pick("0", "15", "29")).toEqual({
      success: false,
      errors: { start: messages.outside("15:30", "18:00") },
    });
  });

  it("rejects a start at or after the end of the slot, which would leave no window", () => {
    for (const [hour, minute] of [
      ["18", "0"],
      ["18", "30"],
    ] as const) {
      expect(pick("0", hour, minute)).toMatchObject({
        success: false,
        errors: { start: messages.outside("15:30", "18:00") },
      });
    }
  });

  it("measures the start on the date of the chosen slot, not on another one", () => {
    // 09:00 fits the second slot but lies before the first.
    expect(pick("1", "9", "0").success).toBe(true);
    expect(pick("0", "9", "0").success).toBe(false);
  });
});

describe("readValues and selectionSearch", () => {
  it("round-trips the choice through the query string", () => {
    const values = { slot: "1", hour: "9", minute: "30" };
    expect(readValues(new URLSearchParams(selectionSearch(values)))).toEqual(values);
  });

  it("reads form data and falls back to empty values", () => {
    const form = new FormData();
    form.set("fenster", "0");
    expect(readValues(form)).toEqual({ slot: "0", hour: "", minute: "" });
  });
});
