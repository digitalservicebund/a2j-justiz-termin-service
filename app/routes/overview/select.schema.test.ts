import { describe, expect, it } from "vitest";

import { windowKey } from "~/core/domain/availability";

import { messages, readValues, selectionSearch } from "./select.schema";
import { validateSelection } from "./select.validate.server";

// 15:30 to 18:00 and 09:00 to 13:00 Berlin time in September are 13:30 to 16:00 and 07:00 to 11:00 UTC.
const slots = [
  { slotId: "s1", start: new Date("2026-09-17T13:30:00Z"), end: new Date("2026-09-17T16:00:00Z") },
  { slotId: "s2", start: new Date("2026-09-21T07:00:00Z"), end: new Date("2026-09-21T11:00:00Z") },
];
const keys = slots.map(windowKey);

// The window is picked by its position in `slots`; anything else is passed on as it is.
const pick = (slot: string, hour: string, minute: string, minDurationMinutes?: number) =>
  validateSelection(
    { slot: (/^\d$/.test(slot) && keys[Number(slot)]) || slot, hour, minute },
    slots,
    minDurationMinutes,
  );

describe("validateSelection around midnight and the clock change", () => {
  // 00:30 to 02:00 Berlin time on 2026-09-18 is 22:30 to 00:00 UTC, which starts on the day before.
  const afterMidnight = [
    {
      slotId: "s1",
      start: new Date("2026-09-17T22:30:00Z"),
      end: new Date("2026-09-18T00:00:00Z"),
    },
  ];

  it("measures the start on the Berlin day of the slot, not on the UTC day", () => {
    expect(
      validateSelection(
        { slot: windowKey(afterMidnight[0]!), hour: "1", minute: "15" },
        afterMidnight,
      ),
    ).toEqual({
      success: true,
      window: { start: new Date("2026-09-17T23:15:00Z"), end: afterMidnight[0]!.end },
    });
  });

  // 01:00 to 04:00 Berlin time on 2026-10-25, the day the clocks go back at 03:00.
  const clockChange = [
    {
      slotId: "s1",
      start: new Date("2026-10-24T23:00:00Z"),
      end: new Date("2026-10-25T03:00:00Z"),
    },
  ];

  it("rejects a start in the repeated hour", () => {
    expect(
      validateSelection({ slot: windowKey(clockChange[0]!), hour: "2", minute: "30" }, clockChange),
    ).toEqual({
      success: false,
      errors: { start: messages.notExactlyOnce },
    });
  });

  it("accepts a start before and after the repeated hour", () => {
    expect(
      validateSelection({ slot: windowKey(clockChange[0]!), hour: "1", minute: "30" }, clockChange)
        .success,
    ).toBe(true);
    expect(
      validateSelection({ slot: windowKey(clockChange[0]!), hour: "3", minute: "0" }, clockChange),
    ).toEqual({
      success: true,
      window: { start: new Date("2026-10-25T02:00:00Z"), end: clockChange[0]!.end },
    });
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
    for (const slot of ["", "2", "-1", "x", "0.5", "s1"]) {
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

  it("does not find a window that an answer changed in the meantime", () => {
    // The judge saw 15:30 to 18:00; an answer has since left 16:00 to 18:00 of the slot.
    const narrowed = [{ ...slots[0]!, start: new Date("2026-09-17T14:00:00Z") }];
    expect(validateSelection({ slot: keys[0]!, hour: "16", minute: "30" }, narrowed)).toEqual({
      success: false,
      errors: { slot: messages.slot },
    });
  });

  describe("with a minimum duration", () => {
    it("accepts a start that leaves exactly the minimum duration", () => {
      expect(pick("0", "16", "30", 90)).toEqual({
        success: true,
        window: { start: new Date("2026-09-17T14:30:00Z"), end: slots[0]!.end },
      });
    });

    it("rejects a start that leaves less, and names the latest start", () => {
      expect(pick("0", "16", "31", 90)).toEqual({
        success: false,
        errors: { start: messages.tooShort("16:30", "90 Minuten") },
      });
    });
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
