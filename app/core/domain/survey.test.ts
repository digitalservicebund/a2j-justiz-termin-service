import { describe, expect, it } from "vitest";

import { stateAfterAnswer, type SurveyState } from "./survey.ts";

// Times on one day, as UTC hours and minutes: at("11:30").
const at = (time: string) => new Date(`2026-09-17T${time}:00Z`);
const range = (start: string, end: string) => ({ start: at(start), end: at(end) });
const window = (slotId: string, start: string, end: string) => ({ slotId, ...range(start, end) });

// Two slots: s1 from 11:00 to 15:00, s2 from 16:00 to 18:00.
const state = (overrides: Partial<SurveyState> = {}): SurveyState => ({
  open: true,
  alreadyAnswered: false,
  minDurationMinutes: null,
  slots: [
    { id: "s1", ...range("11:00", "15:00") },
    { id: "s2", ...range("16:00", "18:00") },
  ],
  answers: [],
  ...overrides,
});

describe("stateAfterAnswer", () => {
  it("rejects an answer to a Terminumfrage that is not open", () => {
    expect(stateAfterAnswer(state({ open: false }), [window("s1", "11:00", "15:00")])).toEqual({
      ok: false,
      reason: "closed",
    });
  });

  it("rejects a second answer from a personal link", () => {
    expect(
      stateAfterAnswer(state({ alreadyAnswered: true }), [window("s1", "11:00", "15:00")]),
    ).toEqual({ ok: false, reason: "answered" });
  });

  it("checks that the Terminumfrage is open before anything else", () => {
    expect(stateAfterAnswer(state({ open: false, alreadyAnswered: true }), [])).toEqual({
      ok: false,
      reason: "closed",
    });
  });

  it("rejects a window outside what the other answers leave", () => {
    const others = state({ answers: [{ slotId: "s1", windows: [range("12:00", "13:00")] }] });
    expect(stateAfterAnswer(others, [window("s1", "11:00", "12:30")])).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("rejects a window shorter than the minimum duration", () => {
    expect(
      stateAfterAnswer(state({ minDurationMinutes: 90 }), [window("s1", "11:00", "12:00")]),
    ).toEqual({ ok: false, reason: "unavailable" });
  });

  it("answers every offered slot and keeps the windows within them", () => {
    const result = stateAfterAnswer(state(), [
      window("s1", "12:00", "13:00"),
      window("s1", "12:30", "14:00"),
    ]);

    expect(result).toEqual({
      ok: true,
      answer: {
        responses: [
          { slotId: "s1", available: true },
          { slotId: "s2", available: false },
        ],
        windows: [window("s1", "12:00", "14:00")],
        remaining: [window("s1", "12:00", "14:00")],
        cancelled: false,
      },
    });
  });

  it("gives no answer for a slot the other answers already ruled out", () => {
    const others = state({ answers: [{ slotId: "s2", windows: [] }] });
    const result = stateAfterAnswer(others, [window("s1", "11:00", "15:00")]);

    expect(result.ok && result.answer.responses).toEqual([{ slotId: "s1", available: true }]);
  });

  it("only leaves the time everyone who answered is available", () => {
    const others = state({ answers: [{ slotId: "s1", windows: [range("11:00", "13:00")] }] });
    const result = stateAfterAnswer(others, [
      window("s1", "12:00", "13:00"),
      window("s2", "16:00", "18:00"),
    ]);

    expect(result.ok && result.answer.remaining).toEqual([
      window("s1", "12:00", "13:00"),
      window("s2", "16:00", "18:00"),
    ]);
    expect(result.ok && result.answer.cancelled).toBe(false);
  });

  it("cancels the Terminumfrage when the guest is available in none of the slots", () => {
    const result = stateAfterAnswer(state(), []);

    expect(result).toEqual({
      ok: true,
      answer: {
        responses: [
          { slotId: "s1", available: false },
          { slotId: "s2", available: false },
        ],
        windows: [],
        remaining: [],
        cancelled: true,
      },
    });
  });

  it("cancels the Terminumfrage when the last remaining window is ruled out", () => {
    const others = state({
      answers: [
        { slotId: "s1", windows: [range("11:00", "12:00")] },
        { slotId: "s2", windows: [] },
      ],
    });
    const result = stateAfterAnswer(others, []);

    expect(result.ok && result.answer.responses).toEqual([{ slotId: "s1", available: false }]);
    expect(result.ok && result.answer.cancelled).toBe(true);
  });

  it("keeps the Terminumfrage open while one slot is left", () => {
    const result = stateAfterAnswer(state(), [window("s2", "16:00", "17:00")]);

    expect(result.ok && result.answer.remaining).toEqual([window("s2", "16:00", "17:00")]);
    expect(result.ok && result.answer.cancelled).toBe(false);
  });
});
