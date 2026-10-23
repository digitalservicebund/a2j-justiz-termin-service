import { describe, expect, it } from "vitest";

import {
  describeAnswers,
  groupWindows,
  MAX_NAME_LENGTH,
  messages,
  readValues,
  surveyPath,
  surveySearch,
  validateSurvey,
} from "../survey.schema";

// 10:00 to 14:00, 09:00 to 11:00 and 15:30 to 17:00 Berlin time in September are 08:00 to 12:00,
// 07:00 to 09:00 and 13:30 to 15:00 UTC.
const slots = [
  { id: "s1", start: new Date("2026-09-17T08:00:00Z"), end: new Date("2026-09-17T12:00:00Z") },
  { id: "s2", start: new Date("2026-09-21T07:00:00Z"), end: new Date("2026-09-21T09:00:00Z") },
  { id: "s3", start: new Date("2026-09-21T13:30:00Z"), end: new Date("2026-09-21T15:00:00Z") },
];

const universal = { needsName: true, slotIds: ["s1", "s2", "s3"] };
const personal = { needsName: false, slotIds: ["s1", "s2", "s3"] };

describe("survey values", () => {
  it("round-trips through the query string", () => {
    const values = { name: "Guest C", available: ["s1", "s3"], none: false };
    expect(readValues(new URLSearchParams(surveySearch(values)))).toEqual(values);

    const none = { name: "", available: [], none: true };
    expect(surveySearch(none)).toBe("keines=1");
    expect(readValues(new URLSearchParams(surveySearch(none)))).toEqual(none);
  });

  it("reads a submitted form and ignores uploaded files", () => {
    const form = new FormData();
    form.set("name", "Guest C");
    form.append("verfuegbar", "s2");
    form.append("verfuegbar", new File(["x"], "x.txt"));
    form.set("keines", "1");

    expect(readValues(form)).toEqual({ name: "Guest C", available: ["s2"], none: true });
    expect(readValues(new FormData())).toEqual({ name: "", available: [], none: false });
  });

  it("builds survey paths with an encoded token", () => {
    expect(surveyPath("a/b")).toBe("/umfrage/a%2Fb");
    expect(surveyPath("a1", "/zusammenfassung")).toBe("/umfrage/a1/zusammenfassung");
  });
});

describe("validateSurvey", () => {
  it("accepts available windows and trims the name", () => {
    expect(
      validateSurvey({ name: "  Guest C ", available: ["s1", "s1", "s3"], none: false }, universal),
    ).toEqual({ success: true, name: "Guest C", availableSlotIds: ["s1", "s3"] });
  });

  it("accepts the answer that no window fits", () => {
    expect(validateSurvey({ name: "Guest C", available: [], none: true }, universal)).toEqual({
      success: true,
      name: "Guest C",
      availableSlotIds: [],
    });
  });

  it("does not ask a personal link for a name", () => {
    expect(validateSurvey({ name: "", available: ["s2"], none: false }, personal)).toEqual({
      success: true,
      name: "",
      availableSlotIds: ["s2"],
    });
  });

  it("needs a name behind the universal link", () => {
    for (const name of ["", "   "]) {
      expect(validateSurvey({ name, available: ["s1"], none: false }, universal)).toEqual({
        success: false,
        errors: { name: messages.name },
      });
    }
  });

  it("limits the length of the name", () => {
    const fits = "a".repeat(MAX_NAME_LENGTH);
    expect(validateSurvey({ name: fits, available: ["s1"], none: false }, universal).success).toBe(
      true,
    );
    expect(validateSurvey({ name: `${fits}a`, available: ["s1"], none: false }, universal)).toEqual(
      { success: false, errors: { name: messages.nameLength } },
    );
  });

  it("needs a window or the answer that none fits", () => {
    expect(validateSurvey({ name: "Guest C", available: [], none: false }, universal)).toEqual({
      success: false,
      errors: { slots: messages.noChoice },
    });
  });

  it("rejects windows together with the answer that none fits", () => {
    expect(validateSurvey({ name: "Guest C", available: ["s1"], none: true }, universal)).toEqual({
      success: false,
      errors: { slots: messages.contradiction },
    });
  });

  it("rejects windows that are not offered", () => {
    expect(
      validateSurvey({ name: "Guest C", available: ["s1", "other"], none: false }, universal),
    ).toEqual({ success: false, errors: { slots: messages.unavailable } });
  });

  it("reports the name and the windows together", () => {
    expect(validateSurvey({ name: "", available: [], none: false }, universal)).toEqual({
      success: false,
      errors: { name: messages.name, slots: messages.noChoice },
    });
  });
});

describe("groupWindows", () => {
  it("groups windows by Berlin day and formats the times", () => {
    expect(groupWindows(slots)).toEqual([
      {
        key: "2026-09-17",
        label: "17. September 2026",
        windows: [{ id: "s1", start: "10:00", time: "10:00 bis 14:00" }],
      },
      {
        key: "2026-09-21",
        label: "21. September 2026",
        windows: [
          { id: "s2", start: "09:00", time: "09:00 bis 11:00" },
          { id: "s3", start: "15:30", time: "15:30 bis 17:00" },
        ],
      },
    ]);
  });

  it("has no days without windows", () => {
    expect(groupWindows([])).toEqual([]);
  });

  it("puts a window shortly after midnight on the Berlin day, not the UTC day", () => {
    // 00:30 Berlin time on 18 September is 22:30 UTC on 17 September.
    const [day] = groupWindows([
      { id: "s4", start: new Date("2026-09-17T22:30:00Z"), end: new Date("2026-09-18T00:30:00Z") },
    ]);
    expect(day).toMatchObject({ key: "2026-09-18", label: "18. September 2026" });
  });
});

describe("describeAnswers", () => {
  it("marks every offered window as available or not", () => {
    expect(describeAnswers(groupWindows(slots), ["s1", "s3"])).toEqual([
      { key: "2026-09-17", label: "17. September 2026", lines: ["10:00 – verfügbar"] },
      {
        key: "2026-09-21",
        label: "21. September 2026",
        lines: ["09:00 – nicht verfügbar", "15:30 – verfügbar"],
      },
    ]);
  });

  it("marks everything as unavailable when none fits", () => {
    const lines = describeAnswers(groupWindows(slots), []).flatMap((day) => day.lines);
    expect(lines).toEqual([
      "10:00 – nicht verfügbar",
      "09:00 – nicht verfügbar",
      "15:30 – nicht verfügbar",
    ]);
  });
});
