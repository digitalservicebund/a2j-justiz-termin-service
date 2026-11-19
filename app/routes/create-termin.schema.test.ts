// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  emptySlot,
  MAX_SLOTS,
  messages,
  parseSlotForm,
  aktenzeichenProblem,
  parseMinDuration,
  validateSlot,
  validateCreateTermin,
  type SlotInput,
} from "./create-termin.schema";

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

// A minimum of one minute lets every window through that ends after it starts.
const validate = (
  slots: SlotInput[],
  aktenzeichen = "574 C 65412/26",
  minDurationMinutes: number | null = 1,
) => validateCreateTermin({ aktenzeichen, minDurationMinutes, slots }, now);

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

  describe("minimum duration", () => {
    it("requires a value", () => {
      expect(errorsOf(validate(validSlots(), "A", null)).minDuration).toBe(
        "Geben Sie eine Mindestdauer an.",
      );
    });

    it("accepts windows that are exactly as long", () => {
      expect(validate(validSlots(), "A", 30)).toEqual({ success: true });
    });

    it("flags every window that is shorter, on its row", () => {
      const long = slotOn({ day: "10", endHour: "17" });
      expect(errorsOf(validate([slotOn(), long, slotOn({ day: "11" })], "A", 31))).toEqual({
        rows: {
          0: { range: "Das Zeitfenster muss mindestens 31 Minuten lang sein." },
          2: { range: "Das Zeitfenster muss mindestens 31 Minuten lang sein." },
        },
      });
    });

    it("reports an end before the start as that, not as too short", () => {
      const { rows } = errorsOf(
        validate([slotOn({ endHour: "15", endMinute: "00" }), slotOn()], "A", 30),
      );
      expect(rows[0]).toEqual({ range: messages.range });
    });

    it("does not hold windows to a length while the minimum is missing", () => {
      expect(errorsOf(validate(validSlots(), "A", null)).rows).toEqual({});
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
        validateCreateTermin(
          { aktenzeichen: "A", minDurationMinutes: 30, slots: [yesterdayInBerlin, slotOn()] },
          lateNow,
        ),
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

  describe("clock changes", () => {
    // Clocks go forward from 02:00 to 03:00 on 2027-03-28 and back from 03:00 to 02:00 on 2026-10-25.
    const forward = { day: "28", month: "3", year: "2027" };
    const back = { day: "25", month: "10", year: "2026" };

    it("rejects a start or end in the hour that is skipped", () => {
      const result = errorsOf(
        validate([
          ...validSlots(),
          slotOn({ ...forward, startHour: "2", startMinute: "30", endHour: "3", endMinute: "30" }),
          slotOn({ ...forward, startHour: "1", startMinute: "0", endHour: "2", endMinute: "15" }),
        ]),
      );
      expect(result.rows[2]).toEqual({ start: messages.skippedTime });
      expect(result.rows[3]).toEqual({ end: messages.skippedTime });
    });

    it("rejects a start or end in the hour that is repeated", () => {
      const result = errorsOf(
        validate([
          ...validSlots(),
          slotOn({ ...back, startHour: "2", startMinute: "30", endHour: "3", endMinute: "30" }),
          slotOn({ ...back, startHour: "1", startMinute: "0", endHour: "2", endMinute: "15" }),
        ]),
      );
      expect(result.rows[2]).toEqual({ start: messages.repeatedTime });
      expect(result.rows[3]).toEqual({ end: messages.repeatedTime });
    });

    it.each([forward, back])("accepts times next to the changed hour (%j)", (day) => {
      expect(
        validate([
          ...validSlots(),
          slotOn({ ...day, startHour: "1", startMinute: "0", endHour: "1", endMinute: "59" }),
          slotOn({ ...day, startHour: "3", startMinute: "0", endHour: "4", endMinute: "0" }),
        ]),
      ).toEqual({ success: true });
    });
  });

  describe("midnight", () => {
    it("accepts a window from midnight and one that ends at 23:59", () => {
      expect(
        validate([
          slotOn({ startHour: "0", startMinute: "0", endHour: "0", endMinute: "30" }),
          slotOn({ day: "10", startHour: "23", startMinute: "0", endHour: "23", endMinute: "59" }),
        ]),
      ).toEqual({ success: true });
    });

    it("counts today in Berlin time, which is tomorrow in UTC late in the evening", () => {
      // 00:30 on 2026-10-22 in Berlin is still 2026-10-21 in UTC.
      const afterMidnight = new Date("2026-10-21T22:30:00Z");
      const slots = [slotOn({ day: "22", month: "10" }), slotOn({ day: "23", month: "10" })];
      expect(
        validateCreateTermin({ aktenzeichen: "A", minDurationMinutes: 30, slots }, afterMidnight),
      ).toEqual({
        success: true,
      });
      expect(
        errorsOf(
          validateCreateTermin(
            {
              aktenzeichen: "A",
              minDurationMinutes: 30,
              slots: [slotOn({ day: "21", month: "10" }), ...slots],
            },
            afterMidnight,
          ),
        ).rows[0],
      ).toEqual({ date: messages.pastDate });
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

describe("parseSlotForm", () => {
  it("reads every slot field", () => {
    const form = new FormData();
    form.set("day", "1");
    form.set("startHour", "8");
    form.set("unknown", "x");

    expect(parseSlotForm(form)).toEqual({ ...emptySlot, day: "1", startHour: "8" });
  });

  it("falls back to an empty slot, and ignores file uploads", () => {
    expect(parseSlotForm(new FormData())).toEqual(emptySlot);
    const form = new FormData();
    form.set("day", new File(["x"], "x.txt"));
    expect(parseSlotForm(form)).toEqual(emptySlot);
  });
});

describe("aktenzeichenProblem", () => {
  it("accepts a filled-in Aktenzeichen", () => {
    expect(aktenzeichenProblem(" A 1 ", { required: true })).toBeUndefined();
  });

  it("only asks for one when it is required", () => {
    expect(aktenzeichenProblem("  ", { required: true })).toBe(messages.aktenzeichenRequired);
    expect(aktenzeichenProblem("  ", { required: false })).toBeUndefined();
  });

  it("rejects one that is too long either way", () => {
    expect(aktenzeichenProblem("A".repeat(51), { required: false })).toBe(
      messages.aktenzeichenTooLong,
    );
    expect(aktenzeichenProblem(`${"A".repeat(50)}  `, { required: true })).toBeUndefined();
  });
});

describe("parseMinDuration", () => {
  it.each([
    ["15", 15],
    [" 120 ", 120],
    ["1", 1],
    ["090", 90],
    ["1439", 1439],
  ])("reads %j as minutes", (typed, minutes) => {
    expect(parseMinDuration(typed, { required: true })).toEqual({ minutes });
  });

  it("only asks for one when it is required", () => {
    expect(parseMinDuration("  ", { required: true })).toEqual({
      problem: messages.minDurationRequired,
    });
    expect(parseMinDuration("  ", { required: false })).toEqual({ minutes: null });
  });

  it.each(["0", "-30", "1,5", "1.5", "30 min", "eine Stunde", "1e2"])(
    "rejects %j, which is not a whole number of minutes",
    (typed) => {
      expect(parseMinDuration(typed, { required: false })).toEqual({
        problem: messages.minDurationInvalid,
      });
    },
  );

  it("rejects more minutes than a window within one day can have", () => {
    expect(parseMinDuration("1440", { required: false })).toEqual({
      problem: "Die Mindestdauer darf höchstens 1439 Minuten betragen.",
    });
  });
});

const check = (
  slot: SlotInput,
  others: SlotInput[] = [],
  minDurationMinutes: number | null = null,
) => validateSlot(slot, others, now, minDurationMinutes);

function slotErrors(result: ReturnType<typeof check>) {
  if (result.success) throw new Error("expected validation to fail");
  return result.errors;
}

describe("validateSlot", () => {
  it("accepts a valid slot", () => {
    expect(check(slotOn())).toEqual({ success: true });
  });

  it("flags every empty part of an empty slot", () => {
    expect(slotErrors(check(emptySlot))).toEqual({
      date: messages.date,
      start: messages.start,
      end: messages.end,
    });
  });

  it("flags a date in the past, but not today", () => {
    expect(slotErrors(check(slotOn({ day: "20", month: "10" }))).date).toBe(messages.pastDate);
    expect(check(slotOn({ day: "21", month: "10" }))).toEqual({ success: true });
  });

  it("flags an end that is not after the start", () => {
    expect(slotErrors(check(slotOn({ endHour: "15", endMinute: "30" }))).range).toBe(
      messages.range,
    );
  });

  it("flags a slot that is shorter than the minimum duration", () => {
    expect(slotErrors(check(slotOn(), [], 31))).toEqual({
      range: "Das Zeitfenster muss mindestens 31 Minuten lang sein.",
    });
    expect(slotErrors(check(slotOn({ endHour: "15", endMinute: "31" }), [], 1 + 1)).range).toBe(
      "Das Zeitfenster muss mindestens 2 Minuten lang sein.",
    );
  });

  it("accepts a slot that is exactly as long as the minimum duration, or longer", () => {
    expect(check(slotOn(), [], 30)).toEqual({ success: true });
    expect(check(slotOn({ endHour: "18" }), [], 120)).toEqual({ success: true });
  });

  it("names a minimum of one minute in the singular", () => {
    expect(messages.tooShort(1)).toBe("Das Zeitfenster muss mindestens 1 Minute lang sein.");
  });

  it("flags times the clock change skips or repeats", () => {
    const skipped = slotOn({ day: "28", month: "3", year: "2027", startHour: "2" });
    expect(slotErrors(check(skipped)).start).toBe(messages.skippedTime);
    const repeated = slotOn({ day: "31", month: "10", year: "2027", startHour: "2" });
    expect(slotErrors(check(repeated)).start).toBe(messages.repeatedTime);
  });

  it("flags an overlap and names the other slot by date and time", () => {
    const errors = slotErrors(check(slotOn({ startHour: "15", startMinute: "45" }), [slotOn()]));

    expect(errors.overlap).toBe(messages.overlapWith("am 9. November 2026, 15:30 bis 16:00"));
  });

  it("lets slots touch, and ignores other slots on other days or without a valid time", () => {
    expect(check(slotOn({ startHour: "16", endHour: "17" }), [slotOn()])).toEqual({
      success: true,
    });
    expect(check(slotOn(), [slotOn({ day: "10" }), emptySlot])).toEqual({ success: true });
  });

  it("does not hold other slots to the no-past-dates rule", () => {
    const earlier = slotOn({ day: "1", month: "1", year: "2020" });
    expect(check(earlier, [earlier])).toMatchObject({ success: false });
    expect(check(slotOn(), [earlier])).toEqual({ success: true });
  });
});
