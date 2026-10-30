import { describe, expect, it } from "vitest";

import {
  addDays,
  addWindows,
  dragRange,
  formatDate,
  formatTime,
  mondayOf,
  nextWorkingDay,
  normalizeDate,
  normalizeTime,
  parseDate,
  parseDateList,
  parseEnd,
  parseTime,
  parseTimeRange,
  slotToWindow,
  sortWindows,
  summarizeAdd,
  weekdayShort,
  windowToSlot,
} from "../create-termin.entry";
import { MAX_SLOTS } from "../create-termin.schema";

// A Tuesday.
const TODAY = "2026-10-27";

describe("dates", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("names the weekday", () => {
    expect(weekdayShort("2026-10-27")).toBe("Di");
    expect(weekdayShort("2026-11-01")).toBe("So");
  });

  it("formats day, month and year", () => {
    expect(formatDate("2026-01-05")).toBe("05.01.2026");
  });

  it.each([
    ["2026-10-30", "2026-11-02"],
    ["2026-10-31", "2026-11-02"],
    ["2026-11-01", "2026-11-02"],
    ["2026-10-27", "2026-10-28"],
  ])("moves from %s to the next working day %s", (from, to) => {
    expect(nextWorkingDay(from)).toBe(to);
  });
});

describe("parseDate", () => {
  it.each([
    ["27.10.2026", "2026-10-27"],
    ["5.1.2027", "2027-01-05"],
    ["05.01.27", "2027-01-05"],
    ["2026-12-24", "2026-12-24"],
    [" 27.10.2026. ", "2026-10-27"],
    ["29.02.2028", "2028-02-29"],
  ])("reads %s", (text, iso) => {
    expect(parseDate(text, TODAY)).toBe(iso);
  });

  it("takes the current year for a date without one, or the next if it has passed", () => {
    expect(parseDate("27.10.", TODAY)).toBe("2026-10-27");
    expect(parseDate("28.10", TODAY)).toBe("2026-10-28");
    expect(parseDate("26.10.", TODAY)).toBe("2027-10-26");
  });

  it("reads words", () => {
    expect(parseDate("heute", TODAY)).toBe("2026-10-27");
    expect(parseDate("Morgen", TODAY)).toBe("2026-10-28");
    expect(parseDate("übermorgen", TODAY)).toBe("2026-10-29");
  });

  it("reads a weekday as the next such day after today", () => {
    expect(parseDate("mi", TODAY)).toBe("2026-10-28");
    expect(parseDate("Freitag", TODAY)).toBe("2026-10-30");
    expect(parseDate("di.", TODAY)).toBe("2026-11-03");
    expect(parseDate("mo", TODAY)).toBe("2026-11-02");
  });

  it.each(["", "abc", "31.04.2026", "30.02.", "13.13.2026", "1.2.3.4", "2026-13-01", "27/10/2026"])(
    "does not read %j",
    (text) => {
      expect(parseDate(text, TODAY)).toBeNull();
    },
  );

  it("normalizes a readable date and leaves the rest alone", () => {
    expect(normalizeDate("5.11.", TODAY)).toBe("05.11.2026");
    expect(normalizeDate("whenever", TODAY)).toBe("whenever");
  });
});

describe("parseDateList", () => {
  it("splits on commas, semicolons and line breaks", () => {
    expect(parseDateList("27.10.2026, 28.10.2026;29.10.2026\n30.10.2026", TODAY)).toEqual({
      dates: ["2026-10-27", "2026-10-28", "2026-10-29", "2026-10-30"],
      invalid: [],
    });
  });

  it("returns what it could not read", () => {
    expect(parseDateList("27.10.2026, soon,, 31.04.2026", TODAY)).toEqual({
      dates: ["2026-10-27"],
      invalid: ["soon", "31.04.2026"],
    });
  });

  it("returns nothing for an empty field", () => {
    expect(parseDateList("  ", TODAY)).toEqual({ dates: [], invalid: [] });
  });
});

describe("times", () => {
  it.each([
    ["9", 540],
    ["09", 540],
    ["9:30", 570],
    ["9.30", 570],
    ["930", 570],
    ["0930", 570],
    ["9 Uhr", 540],
    ["0:00", 0],
    ["23:59", 1439],
  ])("reads %s", (text, minutes) => {
    expect(parseTime(text)).toBe(minutes);
  });

  it.each(["", "24", "9:60", "25:00", "abc", "9:5", "12345", "-1"])("does not read %j", (text) => {
    expect(parseTime(text)).toBeNull();
  });

  it("formats and normalizes", () => {
    expect(formatTime(545)).toBe("09:05");
    expect(normalizeTime("930")).toBe("09:30");
    expect(normalizeTime("later")).toBe("later");
  });
});

describe("parseTimeRange", () => {
  it.each(["9-11", "9 - 11", "09:00–11:00", "9 bis 11", "9:00 — 11:00"])("reads %s", (text) => {
    expect(parseTimeRange(text)).toEqual({ start: 540, end: 660 });
  });

  it.each(["9", "9-", "9-11-12", "a-b", ""])("does not read %j", (text) => {
    expect(parseTimeRange(text)).toBeNull();
  });
});

describe("parseEnd", () => {
  it("reads a time", () => {
    expect(parseEnd("11:30", 540)).toBe(690);
    expect(parseEnd("11:30", null)).toBe(690);
  });

  it.each([
    ["+2h", 660],
    ["+2 h", 660],
    ["+1,5h", 630],
    ["+1.5h", 630],
    ["+1h30", 630],
    ["+1h 30min", 630],
    ["+1:30", 630],
    ["+90", 630],
    ["+90min", 630],
    ["+ 90 m", 630],
  ])("counts %s from the start", (text, end) => {
    expect(parseEnd(text, 540)).toBe(end);
  });

  it.each(["+", "+0", "+abc", "+2h30x"])("does not read %j as a length", (text) => {
    expect(parseEnd(text, 540)).toBeNull();
  });

  it("needs a start to count from, and must stay within the day", () => {
    expect(parseEnd("+2h", null)).toBeNull();
    expect(parseEnd("+2h", 23 * 60)).toBeNull();
    expect(parseEnd("+59", 23 * 60)).toBe(23 * 60 + 59);
  });
});

describe("converting between text and slots", () => {
  it("turns readable text into the fields the server checks", () => {
    expect(windowToSlot({ date: "5.1.2099", start: "9", end: "10:30" }, TODAY)).toEqual({
      day: "05",
      month: "01",
      year: "2099",
      startHour: "09",
      startMinute: "00",
      endHour: "10",
      endMinute: "30",
    });
  });

  it("passes unreadable text on so it is flagged, never accepted", () => {
    expect(windowToSlot({ date: "soon", start: "x", end: "" }, TODAY)).toEqual({
      day: "soon",
      month: "",
      year: "",
      startHour: "x",
      startMinute: "",
      endHour: "",
      endMinute: "",
    });
  });

  it("turns slots back into text", () => {
    expect(
      slotToWindow({
        day: "05",
        month: "01",
        year: "2099",
        startHour: "09",
        startMinute: "00",
        endHour: "10",
        endMinute: "30",
      }),
    ).toEqual({ date: "05.01.2099", start: "09:00", end: "10:30" });
  });

  it("pads fields that were posted without padding", () => {
    expect(
      slotToWindow({
        day: "5",
        month: "1",
        year: "2099",
        startHour: "9",
        startMinute: "0",
        endHour: "10",
        endMinute: "5",
      }),
    ).toEqual({ date: "05.01.2099", start: "09:00", end: "10:05" });
  });

  it("restores text that could not be read as it was typed", () => {
    const window = { date: "40.1.2099", start: "x", end: "" };

    expect(slotToWindow(windowToSlot(window, TODAY))).toEqual(window);
  });
});

const w = (date: string, start: string) => ({ date, start, end: "23:00" });

describe("sortWindows", () => {
  it("sorts by date, then start time", () => {
    const sorted = sortWindows(
      [w("06.01.2099", "09:00"), w("05.01.2099", "13:00"), w("05.01.2099", "9")],
      TODAY,
    );

    expect(sorted.map((x) => [x.date, x.start])).toEqual([
      ["05.01.2099", "9"],
      ["05.01.2099", "13:00"],
      ["06.01.2099", "09:00"],
    ]);
  });

  it("keeps unreadable windows last, in their order", () => {
    const sorted = sortWindows([w("x", "09:00"), w("05.01.2099", "09:00"), w("", "09:00")], TODAY);

    expect(sorted.map((x) => x.date)).toEqual(["05.01.2099", "x", ""]);
  });

  it("does not change the list it is given", () => {
    const list = [w("06.01.2099", "09:00"), w("05.01.2099", "09:00")];

    sortWindows(list, TODAY);

    expect(list[0]!.date).toBe("06.01.2099");
  });
});

describe("addWindows", () => {
  const range = { start: 540, end: 600 };

  it("makes one window per date, oldest first, without repeats", () => {
    const result = addWindows([], ["2026-11-03", "2026-11-02", "2026-11-03"], range, TODAY);

    expect(result.added).toEqual([
      { date: "02.11.2026", start: "09:00", end: "10:00" },
      { date: "03.11.2026", start: "09:00", end: "10:00" },
    ]);
    expect(result).toMatchObject({ past: 0, duplicate: 0, overLimit: 0 });
  });

  it("leaves out a past date and counts it, but not today", () => {
    const result = addWindows([], ["2026-10-26", "2026-10-27"], range, TODAY);

    expect(result.added).toHaveLength(1);
    expect(result.past).toBe(1);
  });

  it("leaves out a window that exists in any spelling and counts it", () => {
    const existing = [{ date: "2.11.2026", start: "9", end: "10:00" }];

    const result = addWindows(existing, ["2026-11-02", "2026-11-03"], range, TODAY);

    expect(result.added).toEqual([{ date: "03.11.2026", start: "09:00", end: "10:00" }]);
    expect(result.duplicate).toBe(1);
  });

  it("does not treat another time on the same day as a duplicate", () => {
    const existing = [{ date: "02.11.2026", start: "10:00", end: "11:00" }];

    expect(addWindows(existing, ["2026-11-02"], range, TODAY).added).toHaveLength(1);
  });

  it("stops at the limit and counts what did not fit", () => {
    const existing = Array.from({ length: MAX_SLOTS - 1 }, (_, i) => ({
      date: formatDate(addDays("2027-01-01", i)),
      start: "09:00",
      end: "10:00",
    }));

    const result = addWindows(existing, ["2026-11-02", "2026-11-03", "2026-11-04"], range, TODAY);

    expect(result.added).toHaveLength(1);
    expect(result.overLimit).toBe(2);
  });
});

describe("summarizeAdd", () => {
  const none = { past: 0, duplicate: 0, overLimit: 0 };
  const one = [{ date: "02.11.2026", start: "09:00", end: "10:00" }];

  it("says what was added", () => {
    expect(summarizeAdd({ added: one, ...none })).toBe("1 Zeitfenster hinzugefügt");
  });

  it("says why dates were skipped", () => {
    expect(summarizeAdd({ added: one, past: 2, duplicate: 1, overLimit: 1 })).toBe(
      "1 Zeitfenster hinzugefügt, 4 übersprungen (Datum in der Vergangenheit, bereits vorhanden, höchstens 20 Zeitfenster)",
    );
  });

  it("says when nothing was added", () => {
    expect(summarizeAdd({ added: [], ...none, duplicate: 1 })).toBe(
      "Kein Zeitfenster hinzugefügt, 1 übersprungen (bereits vorhanden)",
    );
  });
});

describe("mondayOf", () => {
  it.each([
    ["2026-10-26", "2026-10-26"],
    ["2026-10-27", "2026-10-26"],
    ["2026-11-01", "2026-10-26"],
    ["2027-01-01", "2026-12-28"],
  ])("starts the week of %s on %s", (day, monday) => {
    expect(mondayOf(day)).toBe(monday);
  });
});

describe("dragRange", () => {
  const nine = 9 * 60;
  const ten = 10 * 60;
  const taken = [{ start: nine, end: ten }];

  it("makes a single cell from a click", () => {
    expect(dragRange(8 * 60, 8 * 60, [])).toEqual({ start: 8 * 60, end: 8 * 60 + 15 });
  });

  it("covers both the first and the last cell of a drag, down or up", () => {
    expect(dragRange(8 * 60, 9 * 60 + 30, [])).toEqual({ start: 8 * 60, end: 9 * 60 + 45 });
    expect(dragRange(9 * 60 + 30, 8 * 60, [])).toEqual({ start: 8 * 60, end: 9 * 60 + 45 });
  });

  it("does not start on a taken cell", () => {
    expect(dragRange(nine, ten, taken)).toBeNull();
    expect(dragRange(nine + 30, nine, taken)).toBeNull();
  });

  it("starts right after or before a taken window", () => {
    expect(dragRange(ten, ten, taken)).toEqual({ start: ten, end: ten + 15 });
    expect(dragRange(nine - 15, nine - 15, taken)).toEqual({ start: nine - 15, end: nine });
  });

  it("stops at the next window when dragged down", () => {
    expect(dragRange(8 * 60, 12 * 60, taken)).toEqual({ start: 8 * 60, end: nine });
  });

  it("stops at the previous window when dragged up", () => {
    expect(dragRange(11 * 60, 8 * 60, taken)).toEqual({ start: ten, end: 11 * 60 + 15 });
  });

  it("is not stopped by a window behind the start", () => {
    expect(dragRange(11 * 60, 12 * 60, taken)).toEqual({ start: 11 * 60, end: 12 * 60 + 15 });
  });

  it("stays within the hours of the grid", () => {
    expect(dragRange(18 * 60, 23 * 60, [])).toEqual({ start: 18 * 60, end: 19 * 60 });
    expect(dragRange(8 * 60, 0, [])).toEqual({ start: 7 * 60, end: 8 * 60 + 15 });
  });
});
