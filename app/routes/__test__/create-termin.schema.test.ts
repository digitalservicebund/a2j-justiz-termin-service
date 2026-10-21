// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  emptySlot,
  parseCreateTerminForm,
  validateCreateTermin,
  type SlotInput,
} from "../create-termin.schema";

const now = new Date("2026-10-21T10:00:00+02:00");

const validSlot: SlotInput = {
  day: "9",
  month: "11",
  year: "2026",
  startHour: "15",
  startMinute: "30",
  endHour: "16",
  endMinute: "00",
};

const validate = (slots: SlotInput[], aktenzeichen = "574 C 65412/26") =>
  validateCreateTermin({ aktenzeichen, slots }, now);

function errorsOf(result: ReturnType<typeof validate>) {
  if (result.success) throw new Error("expected validation to fail");
  return result.errors;
}

describe("validateCreateTermin", () => {
  it("accepts a filled row and ignores empty rows", () => {
    expect(validate([validSlot, { ...emptySlot }, { ...emptySlot }])).toEqual({ success: true });
  });

  it("requires an Aktenzeichen", () => {
    expect(errorsOf(validate([validSlot], "  ")).aktenzeichen).toBe(
      "Bitte geben Sie ein Aktenzeichen an.",
    );
  });

  it("requires at least one time window", () => {
    expect(errorsOf(validate([{ ...emptySlot }, { ...emptySlot }])).slots).toBe(
      "Bitte geben Sie mindestens ein Zeitfenster an.",
    );
  });

  it("rejects a partially filled row", () => {
    const { rows } = errorsOf(validate([validSlot, { ...emptySlot, day: "9" }]));
    expect(Object.keys(rows)).toEqual(["1"]);
    expect(Object.keys(rows[1]!).sort()).toEqual(["date", "end", "start"]);
  });

  it("rejects dates that do not exist", () => {
    for (const date of [
      { day: "31", month: "4", year: "2027" },
      { day: "29", month: "2", year: "2027" },
      { day: "0", month: "1", year: "2027" },
      { day: "1", month: "13", year: "2027" },
      { day: "1", month: "1", year: "27" },
      { day: "a", month: "1", year: "2027" },
    ]) {
      expect(errorsOf(validate([{ ...validSlot, ...date }])).rows[0]?.date).toBe(
        "Bitte geben Sie ein gültiges Datum an.",
      );
    }
    expect(validate([{ ...validSlot, day: "29", month: "2", year: "2028" }]).success).toBe(true);
  });

  it("rejects invalid times", () => {
    const { rows } = errorsOf(validate([{ ...validSlot, startHour: "24", endMinute: "60" }]));
    expect(rows[0]?.start).toBe("Bitte geben Sie eine gültige Startzeit an.");
    expect(rows[0]?.end).toBe("Bitte geben Sie eine gültige Endzeit an.");
  });

  it("rejects an end time that is not after the start time", () => {
    for (const end of [
      { endHour: "15", endMinute: "30" },
      { endHour: "9", endMinute: "0" },
    ]) {
      expect(errorsOf(validate([{ ...validSlot, ...end }])).rows[0]?.range).toBe(
        "Die Endzeit muss nach der Startzeit liegen.",
      );
    }
  });

  it("rejects past dates but accepts today", () => {
    expect(errorsOf(validate([{ ...validSlot, day: "20", month: "10" }])).rows[0]?.date).toBe(
      "Das Datum darf nicht in der Vergangenheit liegen.",
    );
    expect(validate([{ ...validSlot, day: "21", month: "10" }]).success).toBe(true);
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
});
