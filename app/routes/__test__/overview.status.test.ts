import { describe, expect, it } from "vitest";

import { describeStatus } from "../overview.status";

// 15:30 Berlin time in November is 14:30 UTC; Monday 9 November 2026.
const slot = {
  start: new Date("2026-11-09T14:30:00Z"),
  end: new Date("2026-11-09T15:30:00Z"),
};
const before = new Date("2026-11-01T12:00:00Z");

describe("describeStatus", () => {
  it("marks drafts as grey", () => {
    expect(describeStatus({ status: "draft", confirmedSlot: null })).toEqual({
      type: "custom-grey",
      text: "Entwurf",
    });
  });

  it("marks open appointments as waiting for replies", () => {
    expect(describeStatus({ status: "open", confirmedSlot: null })).toEqual({
      type: "info",
      text: "Offen für Rückmeldungen",
    });
  });

  it("marks cancelled appointments as danger", () => {
    expect(describeStatus({ status: "cancelled", confirmedSlot: null })).toEqual({
      type: "danger",
      text: "Kein Zeitfenster passt",
    });
  });

  it("shows the date of an upcoming confirmed appointment in Berlin time", () => {
    expect(describeStatus({ status: "confirmed", confirmedSlot: slot }, before)).toEqual({
      type: "success",
      text: "Termin ist Montag, 9. November 2026 um 15:30",
    });
  });

  it("greys out a confirmed appointment that is over, without the announcement", () => {
    const after = new Date("2026-11-09T15:31:00Z");
    expect(describeStatus({ status: "confirmed", confirmedSlot: slot }, after)).toEqual({
      type: "custom-grey",
      text: "Montag, 9. November 2026 um 15:30",
    });
  });

  it("keeps a confirmed appointment highlighted while it is running", () => {
    const during = new Date("2026-11-09T15:00:00Z");
    expect(describeStatus({ status: "confirmed", confirmedSlot: slot }, during).type).toBe(
      "success",
    );
  });

  it("uses Berlin summer time for the displayed time", () => {
    const summer = {
      start: new Date("2026-08-03T11:30:00Z"),
      end: new Date("2026-08-03T12:30:00Z"),
    };
    expect(
      describeStatus(
        { status: "confirmed", confirmedSlot: summer },
        new Date("2026-07-01T12:00:00Z"),
      ).text,
    ).toBe("Termin ist Montag, 3. August 2026 um 13:30");
  });
});
