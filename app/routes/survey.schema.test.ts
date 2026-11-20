import { describe, expect, it } from "vitest";

import { windowKey } from "~/core/domain/availability";

import {
  addWindow,
  describeAnswers,
  groupWindows,
  MAX_NAME_LENGTH,
  messages,
  offerViews,
  readValues,
  removeWindow,
  setSmallerWindow,
  surveyPath,
  surveySearch,
  validateSurvey,
} from "./survey.schema";

// 10:00 to 14:00, 09:00 to 11:00 and 15:30 to 17:00 Berlin time in September are 08:00 to 12:00,
// 07:00 to 09:00 and 13:30 to 15:00 UTC.
const [s1, s2, s3] = [
  { slotId: "s1", start: new Date("2026-09-17T08:00:00Z"), end: new Date("2026-09-17T12:00:00Z") },
  { slotId: "s2", start: new Date("2026-09-21T07:00:00Z"), end: new Date("2026-09-21T09:00:00Z") },
  { slotId: "s3", start: new Date("2026-09-21T13:30:00Z"), end: new Date("2026-09-21T15:00:00Z") },
] as const;
const offered = [s1, s2, s3];
const slots = offered.map((window) => ({ id: window.slotId, ...window }));
const [k1, k2, k3] = [windowKey(s1), windowKey(s2), windowKey(s3)];

// Smaller windows within s1: 11:00 to 13:00 and 12:30 to 14:00 Berlin time.
const noon = {
  slotId: "s1",
  start: new Date("2026-09-17T09:00:00Z"),
  end: new Date("2026-09-17T11:00:00Z"),
};
const afternoon = {
  slotId: "s1",
  start: new Date("2026-09-17T10:30:00Z"),
  end: new Date("2026-09-17T12:00:00Z"),
};

const universal = { needsName: true, offered, minDurationMinutes: null };
const personal = { needsName: false, offered, minDurationMinutes: null };

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

// A guest of a personal link who is available in the given windows.
const answer = (available: string[], minDurationMinutes: number | null = null) =>
  validateSurvey(
    { name: "", available, none: false },
    { needsName: false, offered, minDurationMinutes },
  );

describe("validateSurvey", () => {
  it("accepts available windows and trims the name", () => {
    expect(
      validateSurvey({ name: "  Guest C ", available: [k1, k1, k3], none: false }, universal),
    ).toEqual({ success: true, name: "Guest C", availability: [s1, s3] });
  });

  it("accepts the answer that no window fits", () => {
    expect(validateSurvey({ name: "Guest C", available: [], none: true }, universal)).toEqual({
      success: true,
      name: "Guest C",
      availability: [],
    });
  });

  it("does not ask a personal link for a name", () => {
    expect(validateSurvey({ name: "", available: [k2], none: false }, personal)).toEqual({
      success: true,
      name: "",
      availability: [s2],
    });
  });

  it("needs a name behind the universal link", () => {
    for (const name of ["", "   "]) {
      expect(validateSurvey({ name, available: [k1], none: false }, universal)).toEqual({
        success: false,
        errors: { name: messages.name },
      });
    }
  });

  it("limits the length of the name", () => {
    const fits = "a".repeat(MAX_NAME_LENGTH);
    expect(validateSurvey({ name: fits, available: [k1], none: false }, universal).success).toBe(
      true,
    );
    expect(validateSurvey({ name: `${fits}a`, available: [k1], none: false }, universal)).toEqual({
      success: false,
      errors: { name: messages.nameLength },
    });
  });

  it("needs a window or the answer that none fits", () => {
    expect(validateSurvey({ name: "Guest C", available: [], none: false }, universal)).toEqual({
      success: false,
      errors: { slots: messages.noChoice },
    });
  });

  it("rejects windows together with the answer that none fits", () => {
    expect(validateSurvey({ name: "Guest C", available: [k1], none: true }, universal)).toEqual({
      success: false,
      errors: { slots: messages.contradiction },
    });
  });

  it("rejects windows that are not offered or cannot be read", () => {
    const elsewhere = windowKey({ ...s1, slotId: "other" });
    for (const key of [elsewhere, "s1", "other", `${k1}_x`]) {
      expect(
        validateSurvey({ name: "Guest C", available: [k1, key], none: false }, universal),
      ).toEqual({ success: false, errors: { slots: messages.unavailable } });
    }
  });

  it("reports the name and the windows together", () => {
    expect(validateSurvey({ name: "", available: [], none: false }, universal)).toEqual({
      success: false,
      errors: { name: messages.name, slots: messages.noChoice },
    });
  });

  describe("with smaller windows", () => {
    it("accepts a window within an offered one", () => {
      expect(answer([windowKey(noon), k2])).toMatchObject({ availability: [noon, s2] });
    });

    it("merges windows of a slot that overlap or touch", () => {
      expect(answer([windowKey(afternoon), windowKey(noon)])).toMatchObject({
        availability: [{ slotId: "s1", start: noon.start, end: afternoon.end }],
      });
    });

    it("rejects a window that reaches beyond what is offered instead of clipping it", () => {
      // Another answer has left only 12:00 to 14:00 of s1 since the guest saw it.
      const narrowed = [{ ...s1, start: new Date("2026-09-17T10:00:00Z") }, s2, s3];
      for (const key of [k1, windowKey(noon)]) {
        expect(
          validateSurvey(
            { name: "", available: [key], none: false },
            { needsName: false, offered: narrowed, minDurationMinutes: null },
          ),
        ).toEqual({ success: false, errors: { slots: messages.unavailable } });
      }
    });

    it("rejects a window shorter than the minimum duration", () => {
      expect(answer([windowKey(noon)], 120).success).toBe(true);
      expect(answer([windowKey(noon)], 121)).toEqual({
        success: false,
        errors: { slots: messages.unavailable },
      });
    });
  });
});

describe("addWindow and removeWindow", () => {
  it("adds a window to the draft", () => {
    expect(addWindow([k2], noon)).toEqual([windowKey(noon), k2]);
  });

  it("merges it with windows of the same slot right away", () => {
    expect(addWindow([windowKey(noon), k2], afternoon)).toEqual([
      windowKey({ slotId: "s1", start: noon.start, end: afternoon.end }),
      k2,
    ]);
  });

  it("turns windows that cover the whole offered window into that window", () => {
    const morning = { slotId: "s1", start: s1.start, end: noon.start };
    expect(addWindow([windowKey(morning), windowKey(noon)], afternoon)).toEqual([k1]);
  });

  it("replaces the window that was edited", () => {
    expect(addWindow([windowKey(noon), k2], afternoon, windowKey(noon))).toEqual([
      windowKey(afternoon),
      k2,
    ]);
  });

  it("drops keys it cannot read", () => {
    expect(addWindow(["nonsense"], noon)).toEqual([windowKey(noon)]);
  });

  it("removes a window", () => {
    expect(removeWindow([windowKey(noon), k2], windowKey(noon))).toEqual([k2]);
  });

  it("removes a window as the survey shows it, merged from the keys of the draft", () => {
    const merged = windowKey({ slotId: "s1", start: noon.start, end: afternoon.end });
    expect(removeWindow([windowKey(noon), windowKey(afternoon), k2], merged)).toEqual([k2]);
  });
});

describe("setSmallerWindow", () => {
  it("replaces the tick of the whole offered window", () => {
    expect(setSmallerWindow([k1, k2], k1, noon)).toEqual([windowKey(noon), k2]);
  });

  it("is the tick again when the window is the whole offered one", () => {
    expect(setSmallerWindow([k2], k1, s1)).toEqual([k1, k2]);
  });

  it("changes a window and merges it with the others", () => {
    const morning = { slotId: "s1", start: s1.start, end: noon.start };
    expect(setSmallerWindow([windowKey(morning), k2], k1, afternoon)).toEqual([
      windowKey(morning),
      windowKey(afternoon),
      k2,
    ]);
    expect(setSmallerWindow([windowKey(morning)], k1, noon, windowKey(morning))).toEqual([
      windowKey(noon),
    ]);
  });
});

describe("offerViews", () => {
  it("tells for every offered window whether the guest is available in all, part or none", () => {
    const views = offerViews([k1, k2, k3], [windowKey(noon), k3]);

    expect(views.get(k1)).toEqual({
      state: "partial",
      windows: [{ key: windowKey(noon), time: "11:00 bis 13:00" }],
    });
    expect(views.get(k2)).toEqual({ state: "none", windows: [] });
    expect(views.get(k3)).toMatchObject({ state: "full" });
  });

  it("ignores keys it cannot read", () => {
    expect(offerViews([k1, "nonsense"], ["nonsense"]).get(k1)).toEqual({
      state: "none",
      windows: [],
    });
  });
});

describe("groupWindows", () => {
  it("groups windows by Berlin day and formats the times", () => {
    expect(groupWindows(slots)).toEqual([
      {
        key: "2026-09-17",
        label: "17. September 2026",
        weekday: "Donnerstag",
        windows: [{ id: "s1", start: "10:00", time: "10:00 bis 14:00" }],
      },
      {
        key: "2026-09-21",
        label: "21. September 2026",
        weekday: "Montag",
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
    expect(day).toMatchObject({
      key: "2026-09-18",
      label: "18. September 2026",
      weekday: "Freitag",
    });
  });
});

describe("describeAnswers", () => {
  it("marks every offered window as available or not", () => {
    expect(describeAnswers(offered, [s1, s3])).toEqual([
      { key: "2026-09-17", label: "17. September 2026", lines: ["10:00 bis 14:00 – verfügbar"] },
      {
        key: "2026-09-21",
        label: "21. September 2026",
        lines: ["09:00 bis 11:00 – nicht verfügbar", "15:30 bis 17:00 – verfügbar"],
      },
    ]);
  });

  it("lists the smaller windows of a window the guest is partly available in", () => {
    const morning = { slotId: "s1", start: s1.start, end: new Date("2026-09-17T08:45:00Z") };
    const [day] = describeAnswers(offered, [noon, morning]);
    expect(day!.lines).toEqual([
      "10:00 bis 14:00 – teilweise verfügbar",
      "10:00 bis 10:45 – verfügbar",
      "11:00 bis 13:00 – verfügbar",
    ]);
  });

  it("marks everything as unavailable when none fits", () => {
    const lines = describeAnswers(offered, []).flatMap((day) => day.lines);
    expect(lines).toEqual([
      "10:00 bis 14:00 – nicht verfügbar",
      "09:00 bis 11:00 – nicht verfügbar",
      "15:30 bis 17:00 – nicht verfügbar",
    ]);
  });
});
