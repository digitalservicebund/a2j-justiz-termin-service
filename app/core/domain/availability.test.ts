import { describe, expect, it } from "vitest";

import {
  answersByOffer,
  checkAvailability,
  contains,
  intersectRanges,
  isLongEnough,
  mergeRanges,
  mergeWindows,
  parseWindowKey,
  remainingWindows,
  windowKey,
} from "./availability";

// Times on one day, as UTC hours and minutes: at("11:30").
const at = (time: string) => new Date(`2026-09-17T${time}:00Z`);
const range = (start: string, end: string) => ({ start: at(start), end: at(end) });
const window = (slotId: string, start: string, end: string) => ({ slotId, ...range(start, end) });

// The slot of the example: 11:00 to 15:00.
const slot = { id: "s1", ...range("11:00", "15:00") };
const answer = (...windows: Array<[string, string]>) => ({
  slotId: "s1",
  windows: windows.map(([start, end]) => range(start, end)),
});

describe("isLongEnough", () => {
  it("compares the length with the minimum duration", () => {
    expect(isLongEnough(range("12:00", "13:30"), 90)).toBe(true);
    expect(isLongEnough(range("12:00", "13:29"), 90)).toBe(false);
  });

  it("only asks for a length without a minimum duration", () => {
    expect(isLongEnough(range("12:00", "12:01"), null)).toBe(true);
    expect(isLongEnough(range("12:00", "12:01"))).toBe(true);
    expect(isLongEnough(range("12:00", "12:00"), null)).toBe(false);
    expect(isLongEnough(range("12:00", "11:00"), null)).toBe(false);
  });
});

describe("contains", () => {
  it("includes the bounds", () => {
    expect(contains(slot, range("11:00", "15:00"))).toBe(true);
    expect(contains(slot, range("12:00", "14:00"))).toBe(true);
    expect(contains(slot, range("10:59", "14:00"))).toBe(false);
    expect(contains(slot, range("12:00", "15:01"))).toBe(false);
  });
});

describe("mergeRanges", () => {
  it("sorts ranges and keeps separate ones apart", () => {
    expect(mergeRanges([range("14:00", "15:00"), range("11:00", "12:00")])).toEqual([
      range("11:00", "12:00"),
      range("14:00", "15:00"),
    ]);
  });

  it("merges ranges that overlap, touch or contain each other", () => {
    expect(mergeRanges([range("12:00", "14:00"), range("13:00", "15:00")])).toEqual([
      range("12:00", "15:00"),
    ]);
    expect(mergeRanges([range("14:00", "15:00"), range("12:00", "14:00")])).toEqual([
      range("12:00", "15:00"),
    ]);
    expect(mergeRanges([range("11:00", "15:00"), range("12:00", "13:00")])).toEqual([
      range("11:00", "15:00"),
    ]);
  });

  it("drops ranges without a length and does not change its input", () => {
    const input = [range("12:00", "13:00"), range("13:00", "13:00"), range("12:30", "14:00")];
    expect(mergeRanges(input)).toEqual([range("12:00", "14:00")]);
    expect(input[0]).toEqual(range("12:00", "13:00"));
  });
});

describe("intersectRanges", () => {
  it("keeps the times both lists cover", () => {
    expect(
      intersectRanges(
        [range("09:00", "11:00"), range("15:00", "17:00")],
        [range("10:00", "16:00")],
      ),
    ).toEqual([range("10:00", "11:00"), range("15:00", "16:00")]);
  });

  it("is empty for ranges that only touch or when one list is empty", () => {
    expect(intersectRanges([range("09:00", "11:00")], [range("11:00", "12:00")])).toEqual([]);
    expect(intersectRanges([range("09:00", "11:00")], [])).toEqual([]);
  });
});

describe("mergeWindows", () => {
  it("merges within a slot only and sorts by start", () => {
    expect(
      mergeWindows([
        window("s2", "13:00", "14:00"),
        window("s1", "12:00", "13:00"),
        window("s1", "13:00", "14:00"),
      ]),
    ).toEqual([window("s1", "12:00", "14:00"), window("s2", "13:00", "14:00")]);
  });
});

describe("remainingWindows", () => {
  it("leaves a slot whole that nobody answered", () => {
    expect(remainingWindows([slot], [], 90)).toEqual([window("s1", "11:00", "15:00")]);
  });

  it("leaves a slot whole when everyone is available for all of it", () => {
    const whole = answer(["11:00", "15:00"]);
    expect(remainingWindows([slot], [whole, whole], 90)).toEqual([window("s1", "11:00", "15:00")]);
  });

  it("leaves nothing of a slot one participant cannot attend", () => {
    expect(remainingWindows([slot], [answer(["11:00", "15:00"]), answer()], 90)).toEqual([]);
  });

  it("narrows a slot to a smaller availability window", () => {
    expect(remainingWindows([slot], [answer(["12:00", "14:00"])], 90)).toEqual([
      window("s1", "12:00", "14:00"),
    ]);
  });

  it("keeps only the time all participants have in common", () => {
    const answers = [answer(["11:00", "13:30"]), answer(["12:00", "15:00"])];
    expect(remainingWindows([slot], answers, 90)).toEqual([window("s1", "12:00", "13:30")]);
  });

  it("drops what is shorter than the minimum duration", () => {
    const answers = [answer(["11:00", "13:29"]), answer(["12:00", "15:00"])];
    expect(remainingWindows([slot], answers, 90)).toEqual([]);
    expect(remainingWindows([slot], answers, null)).toEqual([window("s1", "12:00", "13:29")]);
  });

  it("leaves nothing when the participants are available at different times", () => {
    const answers = [answer(["11:00", "13:00"]), answer(["13:00", "15:00"])];
    expect(remainingWindows([slot], answers, null)).toEqual([]);
  });

  it("can leave several windows of one slot", () => {
    const day = { id: "s1", ...range("09:00", "17:00") };
    const answers = [answer(["09:00", "11:00"], ["15:00", "17:00"]), answer(["10:00", "17:00"])];
    expect(remainingWindows([day], answers, 60)).toEqual([
      window("s1", "10:00", "11:00"),
      window("s1", "15:00", "17:00"),
    ]);
    // With a longer minimum duration only the afternoon is long enough.
    expect(remainingWindows([day], answers, 90)).toEqual([window("s1", "15:00", "17:00")]);
  });

  it("reads windows that overlap or come unsorted as their union", () => {
    const messy = answer(["13:00", "14:00"], ["12:00", "13:30"]);
    expect(remainingWindows([slot], [messy], 90)).toEqual([window("s1", "12:00", "14:00")]);
  });

  it("ignores availability outside the slot", () => {
    expect(remainingWindows([slot], [answer(["10:00", "12:30"])], 90)).toEqual([
      window("s1", "11:00", "12:30"),
    ]);
  });

  it("treats every slot on its own and sorts the result by start", () => {
    const later = { id: "s2", ...range("16:00", "18:00") };
    const answers = [answer(["12:00", "14:00"]), { slotId: "s2", windows: [] }];
    expect(remainingWindows([later, slot], answers, 90)).toEqual([window("s1", "12:00", "14:00")]);
    expect(remainingWindows([later, slot], [answers[0]!], 90)).toEqual([
      window("s1", "12:00", "14:00"),
      window("s2", "16:00", "18:00"),
    ]);
  });
});

describe("checkAvailability", () => {
  const offered = [window("s1", "12:00", "14:00"), window("s2", "16:00", "18:00")];

  it("accepts whole offered windows and smaller ones, and no windows at all", () => {
    const windows = [window("s1", "12:00", "14:00"), window("s2", "16:30", "18:00")];
    expect(checkAvailability(windows, offered, 90)).toEqual({ ok: true, windows });
    expect(checkAvailability([], offered, 90)).toEqual({ ok: true, windows: [] });
  });

  it("merges windows that overlap or touch before checking them", () => {
    const halves = [window("s1", "13:00", "14:00"), window("s1", "12:00", "13:00")];
    expect(checkAvailability(halves, offered, 90)).toEqual({
      ok: true,
      windows: [window("s1", "12:00", "14:00")],
    });
  });

  it("rejects a window that reaches beyond what is offered", () => {
    for (const outside of [
      window("s1", "11:00", "14:00"),
      window("s1", "12:00", "14:01"),
      window("s2", "12:00", "14:00"),
      window("s3", "12:00", "14:00"),
    ]) {
      expect(checkAvailability([outside], offered, 90)).toEqual({ ok: false, problem: "outside" });
    }
  });

  it("rejects a window that spans the gap between two offered windows of a slot", () => {
    const split = [window("s1", "09:00", "11:00"), window("s1", "15:00", "17:00")];
    expect(checkAvailability([window("s1", "10:00", "16:00")], split, null)).toEqual({
      ok: false,
      problem: "outside",
    });
  });

  it("rejects a window shorter than the minimum duration", () => {
    expect(checkAvailability([window("s1", "12:00", "13:29")], offered, 90)).toEqual({
      ok: false,
      problem: "tooShort",
    });
    expect(checkAvailability([window("s1", "12:00", "13:29")], offered, null).ok).toBe(true);
  });
});

describe("answersByOffer", () => {
  const offered = [window("s1", "11:00", "15:00"), window("s2", "16:00", "18:00")];

  it("tells full, partial and no availability apart", () => {
    const smaller = [window("s1", "11:00", "12:00"), window("s1", "13:00", "15:00")];
    expect(answersByOffer(offered, smaller)).toEqual([
      { offer: offered[0], state: "partial", windows: smaller },
      { offer: offered[1], state: "none", windows: [] },
    ]);
    expect(answersByOffer(offered, [offered[1]!])[1]).toMatchObject({ state: "full" });
  });

  it("is full once smaller windows together cover the offer", () => {
    const halves = [window("s1", "11:00", "13:00"), window("s1", "13:00", "15:00")];
    expect(answersByOffer(offered, halves)[0]).toEqual({
      offer: offered[0],
      state: "full",
      windows: [offered[0]],
    });
  });
});

describe("windowKey", () => {
  it("round-trips a window, also when the slot id contains the separator", () => {
    for (const slotId of ["s1", "0b0f9a8e-1c2d-4e3f-8a9b-0c1d2e3f4a5b", "a_b"]) {
      const original = window(slotId, "12:00", "14:00");
      expect(parseWindowKey(windowKey(original))).toEqual(original);
    }
  });

  it("differs for the same slot at other times", () => {
    expect(windowKey(window("s1", "12:00", "14:00"))).not.toBe(
      windowKey(window("s1", "12:00", "13:00")),
    );
  });

  it("does not read anything else", () => {
    const start = at("12:00").getTime();
    for (const key of ["", "s1", `s1_${start}`, `s1_${start}_${start}`, `s1_${start}_x`, `_1_2`]) {
      expect(parseWindowKey(key)).toBeUndefined();
    }
  });
});
