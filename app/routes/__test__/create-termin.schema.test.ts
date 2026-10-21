// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  emptySlot,
  MAX_SLOTS,
  parseCreateTerminForm,
  validateCreateTermin,
  type SlotInput,
} from "../create-termin.schema";

const now = new Date("2026-10-21T10:00:00+02:00");

const slotOn = (overrides: Partial<SlotInput> = {}): SlotInput => ({
  day: "9",
  month: "11",
  year: "2026",
  startHour: "15",
  startMinute: "30",
  endHour: "16",
  endMinute: "00",
  ...overrides,
});

// Two valid, non-overlapping windows: the smallest input that passes.
const validSlots = () => [slotOn(), slotOn({ day: "10" })];

const validate = (slots: SlotInput[], aktenzeichen = "574 C 65412/26") =>
  validateCreateTermin({ aktenzeichen, slots }, now);

function errorsOf(result: ReturnType<typeof validate>) {
  if (result.success) throw new Error("expected validation to fail");
  return result.errors;
}

describe("validateCreateTermin", () => {
  it("accepts two valid windows and ignores empty rows", () => {
    expect(validate([...validSlots(), { ...emptySlot }, { ...emptySlot }])).toEqual({
      success: true,
    });
  });

  describe("Aktenzeichen", () => {
    it.each(["", "   "])("requires a value (%j)", (aktenzeichen) => {
      expect(errorsOf(validate(validSlots(), aktenzeichen)).aktenzeichen).toBe(
        "Geben Sie ein Aktenzeichen an.",
      );
    });

    it("rejects more than 50 characters but accepts exactly 50", () => {
      expect(errorsOf(validate(validSlots(), "A".repeat(51))).aktenzeichen).toBe(
        "Das Aktenzeichen darf höchstens 50 Zeichen lang sein.",
      );
      expect(validate(validSlots(), "A".repeat(50)).success).toBe(true);
    });

    it("measures the length after trimming", () => {
      expect(validate(validSlots(), ` ${"A".repeat(50)} `).success).toBe(true);
    });
  });

  describe("number of windows", () => {
    it.each([
      ["no rows at all", []],
      ["only empty rows", [{ ...emptySlot }, { ...emptySlot }, { ...emptySlot }]],
      ["a single valid row", [slotOn(), { ...emptySlot }]],
    ])("requires at least two windows (%s)", (_name, slots) => {
      const errors = errorsOf(validate(slots));
      expect(errors.slots).toBe("Geben Sie mindestens zwei Zeitfenster an.");
      expect(errors.rows).toEqual({});
    });

    it("accepts exactly the maximum number of windows", () => {
      const slots = Array.from({ length: MAX_SLOTS }, (_, i) => slotOn({ day: String(i + 1) }));
      expect(validate(slots).success).toBe(true);
    });

    it("rejects more than the maximum number of windows", () => {
      const slots = Array.from({ length: MAX_SLOTS + 1 }, (_, i) => slotOn({ day: String(i + 1) }));
      expect(errorsOf(validate(slots)).slots).toBe("Geben Sie höchstens 20 Zeitfenster an.");
    });

    it("counts empty rows towards the maximum", () => {
      const slots = [
        ...validSlots(),
        ...Array.from({ length: MAX_SLOTS }, () => ({ ...emptySlot })),
      ];
      expect(errorsOf(validate(slots)).slots).toBe("Geben Sie höchstens 20 Zeitfenster an.");
    });

    it("reports row errors instead of the count while a row is invalid", () => {
      const errors = errorsOf(validate([slotOn(), { ...emptySlot, day: "9" }]));
      expect(errors.slots).toBeUndefined();
      expect(Object.keys(errors.rows)).toEqual(["1"]);
    });
  });

  describe("a single row", () => {
    it("rejects a partially filled row in every part", () => {
      const { rows } = errorsOf(validate([...validSlots(), { ...emptySlot, day: "9" }]));
      expect(Object.keys(rows)).toEqual(["2"]);
      expect(Object.keys(rows[2]!).sort()).toEqual(["date", "end", "start"]);
    });

    it.each([
      ["a day that does not exist in the month", { day: "31", month: "4", year: "2027" }],
      ["29 February in a non-leap year", { day: "29", month: "2", year: "2027" }],
      ["day zero", { day: "0", month: "1", year: "2027" }],
      ["month 13", { day: "1", month: "13", year: "2027" }],
      ["a two-digit year", { day: "1", month: "1", year: "27" }],
      ["a non-numeric day", { day: "a", month: "1", year: "2027" }],
      ["a negative day", { day: "-1", month: "1", year: "2027" }],
      ["a missing month", { day: "1", month: "", year: "2027" }],
    ])("rejects an invalid date: %s", (_name, date) => {
      const { rows } = errorsOf(validate([slotOn(date), slotOn({ day: "10" })]));
      expect(rows[0]?.date).toBe("Geben Sie ein gültiges Datum an.");
    });

    it("accepts 29 February in a leap year", () => {
      const leap = slotOn({ day: "29", month: "2", year: "2028" });
      expect(validate([leap, slotOn()]).success).toBe(true);
    });

    it.each([
      ["hour 24", { startHour: "24" }, "start"],
      ["minute 60", { startMinute: "60" }, "start"],
      ["a non-numeric start hour", { startHour: "ab" }, "start"],
      ["a three-digit start minute", { startMinute: "030" }, "start"],
      ["a missing start minute", { startMinute: "" }, "start"],
      ["end hour 24", { endHour: "24" }, "end"],
      ["end minute 60", { endMinute: "60" }, "end"],
      ["a missing end hour", { endHour: "" }, "end"],
    ] as const)("rejects an invalid time: %s", (_name, overrides, group) => {
      const { rows } = errorsOf(validate([slotOn(overrides), slotOn({ day: "10" })]));
      expect(rows[0]?.[group]).toBe(
        group === "start"
          ? "Geben Sie eine gültige Startzeit an."
          : "Geben Sie eine gültige Endzeit an.",
      );
    });

    it("reports start and end errors together", () => {
      const { rows } = errorsOf(
        validate([slotOn({ startHour: "24", endMinute: "60" }), slotOn({ day: "10" })]),
      );
      expect(rows[0]?.start).toBe("Geben Sie eine gültige Startzeit an.");
      expect(rows[0]?.end).toBe("Geben Sie eine gültige Endzeit an.");
    });

    it.each([
      ["equal to", { endHour: "15", endMinute: "30" }],
      ["before", { endHour: "9", endMinute: "0" }],
      ["one minute before", { endHour: "15", endMinute: "29" }],
    ])("rejects an end time that is %s the start time", (_name, end) => {
      const { rows } = errorsOf(validate([slotOn(end), slotOn({ day: "10" })]));
      expect(rows[0]?.range).toBe("Die Endzeit muss nach der Startzeit liegen.");
    });

    it("does not compare times when one of them is invalid", () => {
      const { rows } = errorsOf(validate([slotOn({ startHour: "99" }), slotOn({ day: "10" })]));
      expect(rows[0]?.range).toBeUndefined();
    });

    it("rejects a date in the past", () => {
      const past = slotOn({ day: "20", month: "10" });
      const { rows } = errorsOf(validate([past, slotOn()]));
      expect(rows[0]?.date).toBe("Das Datum darf nicht in der Vergangenheit liegen.");
    });

    it("accepts today even if the time has already passed", () => {
      const today = slotOn({ day: "21", month: "10", startHour: "8", endHour: "9" });
      expect(validate([today, slotOn()]).success).toBe(true);
    });

    it("uses the date in Berlin, not in UTC", () => {
      // 00:30 in Berlin on 22 October is still 21 October in UTC.
      const lateNow = new Date("2026-10-21T22:30:00Z");
      const yesterdayInBerlin = slotOn({ day: "21", month: "10" });
      const { rows } = errorsOf(
        validateCreateTermin({ aktenzeichen: "A", slots: [yesterdayInBerlin, slotOn()] }, lateNow),
      );
      expect(rows[0]?.date).toBe("Das Datum darf nicht in der Vergangenheit liegen.");
    });

    it("keeps errors per row so each one can be shown in place", () => {
      const { rows } = errorsOf(
        validate([slotOn({ day: "40" }), slotOn({ day: "10" }), slotOn({ endHour: "1" })]),
      );
      expect(Object.keys(rows)).toEqual(["0", "2"]);
      expect(Object.keys(rows[0]!)).toEqual(["date"]);
      expect(Object.keys(rows[2]!)).toEqual(["range"]);
    });
  });

  describe("overlapping windows", () => {
    it("rejects an identical window on the later row", () => {
      const { rows } = errorsOf(validate([slotOn(), slotOn()]));
      expect(rows).toEqual({
        1: { overlap: "Dieses Zeitfenster überschneidet sich mit Zeitfenster 1." },
      });
    });

    it.each([
      [
        "partly overlapping",
        { startHour: "15", startMinute: "45", endHour: "16", endMinute: "30" },
      ],
      [
        "contained in the other",
        { startHour: "15", startMinute: "40", endHour: "15", endMinute: "50" },
      ],
      [
        "containing the other",
        { startHour: "15", startMinute: "0", endHour: "17", endMinute: "0" },
      ],
    ])("rejects a window that is %s", (_name, times) => {
      const { rows } = errorsOf(validate([slotOn(), slotOn(times)]));
      expect(rows[1]?.overlap).toBe("Dieses Zeitfenster überschneidet sich mit Zeitfenster 1.");
      expect(rows[0]).toBeUndefined();
    });

    it("points at the earlier row when empty rows sit in between", () => {
      const { rows } = errorsOf(validate([slotOn(), { ...emptySlot }, slotOn()]));
      expect(rows[2]?.overlap).toBe("Dieses Zeitfenster überschneidet sich mit Zeitfenster 1.");
    });

    it("allows windows that only touch", () => {
      const next = slotOn({ startHour: "16", startMinute: "0", endHour: "17", endMinute: "0" });
      expect(validate([slotOn(), next]).success).toBe(true);
    });

    it("allows the same times on different dates", () => {
      expect(validate([slotOn(), slotOn({ day: "10" })]).success).toBe(true);
    });

    it("ignores rows that already have an error of their own", () => {
      const { rows } = errorsOf(validate([slotOn(), slotOn({ endHour: "10" }), slotOn()]));
      expect(rows[1]?.range).toBeDefined();
      expect(rows[1]?.overlap).toBeUndefined();
      expect(rows[2]?.overlap).toBe("Dieses Zeitfenster überschneidet sich mit Zeitfenster 1.");
    });

    it("suppresses the count error because the overlap is reported instead", () => {
      const errors = errorsOf(validate([slotOn(), slotOn()]));
      expect(errors.slots).toBeUndefined();
    });
  });

  it("reports the Aktenzeichen and row problems together", () => {
    const errors = errorsOf(validate([slotOn({ day: "40" }), slotOn({ day: "10" })], ""));
    expect(errors.aktenzeichen).toBe("Geben Sie ein Aktenzeichen an.");
    expect(errors.rows[0]?.date).toBe("Geben Sie ein gültiges Datum an.");
  });

  it("reports the Aktenzeichen together with a missing window count", () => {
    const errors = errorsOf(validate([], ""));
    expect(errors.aktenzeichen).toBe("Geben Sie ein Aktenzeichen an.");
    expect(errors.slots).toBe("Geben Sie mindestens zwei Zeitfenster an.");
  });
});

describe("parseCreateTerminForm", () => {
  it("collects indexed slot fields in row order", () => {
    const form = new FormData();
    form.set("aktenzeichen", "A 1");
    form.set("slots.2.day", "3");
    form.set("slots.0.day", "1");
    form.set("slots.0.startHour", "8");
    form.set("slots.1.unknown", "x");

    const { aktenzeichen, slots } = parseCreateTerminForm(form);

    expect(aktenzeichen).toBe("A 1");
    expect(slots).toEqual([
      { ...emptySlot, day: "1", startHour: "8" },
      { ...emptySlot, day: "3" },
    ]);
  });

  it("falls back to an empty Aktenzeichen and no rows for an empty form", () => {
    expect(parseCreateTerminForm(new FormData())).toEqual({ aktenzeichen: "", slots: [] });
  });

  it("ignores file uploads and unrelated fields", () => {
    const form = new FormData();
    form.set("slots.0.day", new File(["x"], "x.txt"));
    form.set("something", "else");
    expect(parseCreateTerminForm(form).slots).toEqual([]);
  });
});
