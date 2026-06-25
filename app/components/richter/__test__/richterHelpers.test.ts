import { describe, expect, it } from "vitest";
import {
  decisionToLabel,
  generateRandomSlotDrafts,
  toIsoSlotRanges,
} from "~/components/richter/richterHelpers";

describe("toIsoSlotRanges", () => {
  it("converts a draft to ISO date strings", () => {
    const result = toIsoSlotRanges([
      { startsAtLocal: "2026-06-01T09:00", endsAtLocal: "2026-06-01T10:00" },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].startsAtIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    expect(result[0].endsAtIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("returns an empty array for empty input", () => {
    expect(toIsoSlotRanges([])).toEqual([]);
  });

  it("preserves order and maps all drafts", () => {
    const drafts = [
      { startsAtLocal: "2026-06-01T09:00", endsAtLocal: "2026-06-01T10:00" },
      { startsAtLocal: "2026-06-02T14:00", endsAtLocal: "2026-06-02T15:00" },
    ];
    expect(toIsoSlotRanges(drafts)).toHaveLength(2);
  });
});

describe("decisionToLabel", () => {
  it("returns 'Accepted' for ACCEPT", () => {
    expect(decisionToLabel("ACCEPT")).toBe("Accepted");
  });

  it("returns 'Rejected' for REJECT", () => {
    expect(decisionToLabel("REJECT")).toBe("Rejected");
  });

  it("returns '-' for null", () => {
    expect(decisionToLabel(null)).toBe("-");
  });

  it("returns '-' for undefined", () => {
    expect(decisionToLabel(undefined)).toBe("-");
  });
});

describe("generateRandomSlotDrafts", () => {
  it("generates 3 slots by default", () => {
    expect(generateRandomSlotDrafts()).toHaveLength(3);
  });

  it("generates the requested count", () => {
    expect(generateRandomSlotDrafts(5)).toHaveLength(5);
  });

  it("only generates slots on weekdays", () => {
    const slots = generateRandomSlotDrafts(5);
    for (const slot of slots) {
      const day = new Date(slot.startsAtLocal).getDay();
      expect(day).not.toBe(0);
      expect(day).not.toBe(6);
    }
  });

  it("generates unique days", () => {
    const slots = generateRandomSlotDrafts(3);
    const days = slots.map((s) => s.startsAtLocal.slice(0, 10));
    expect(new Set(days).size).toBe(3);
  });

  it("returns slots sorted by start time", () => {
    const slots = generateRandomSlotDrafts(3);
    for (let i = 1; i < slots.length; i++) {
      expect(slots[i].startsAtLocal >= slots[i - 1].startsAtLocal).toBe(true);
    }
  });
});
