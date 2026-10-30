import { describe, expect, it } from "vitest";

import { applyOverviewQuery, parseOverviewQuery } from "../overview.query";

const entries = [
  { aktenzeichen: "574 C 10/26", status: "cancelled" as const },
  { aktenzeichen: "574 C 2/26", status: "open" as const },
  { aktenzeichen: "574 C 3/26", status: "draft" as const },
  { aktenzeichen: "574 C 4/26", status: "open" as const },
  { aktenzeichen: "574 C 5/26", status: "confirmed" as const },
];

const aktenzeichen = (list: typeof entries) => list.map((entry) => entry.aktenzeichen);

describe("parseOverviewQuery", () => {
  it("defaults to sorting by status without a filter", () => {
    expect(parseOverviewQuery(new URLSearchParams())).toEqual({ sort: "status", filter: "none" });
  });

  it("reads a valid sort and filter", () => {
    expect(parseOverviewQuery(new URLSearchParams("sort=aktenzeichen&filter=open"))).toEqual({
      sort: "aktenzeichen",
      filter: "open",
    });
  });

  it("falls back to the defaults for unknown values", () => {
    expect(parseOverviewQuery(new URLSearchParams("sort=nope&filter=bogus"))).toEqual({
      sort: "status",
      filter: "none",
    });
    expect(parseOverviewQuery(new URLSearchParams("filter=none"))).toEqual({
      sort: "status",
      filter: "none",
    });
  });
});

describe("applyOverviewQuery", () => {
  it("sorts by workflow order of the status, keeping the incoming order within a status", () => {
    const result = applyOverviewQuery(entries, { sort: "status", filter: "none" });
    expect(aktenzeichen(result)).toEqual([
      "574 C 3/26",
      "574 C 2/26",
      "574 C 4/26",
      "574 C 5/26",
      "574 C 10/26",
    ]);
  });

  it("sorts Aktenzeichen naturally, so 2 comes before 10", () => {
    const result = applyOverviewQuery(entries, { sort: "aktenzeichen", filter: "none" });
    expect(aktenzeichen(result)).toEqual([
      "574 C 2/26",
      "574 C 3/26",
      "574 C 4/26",
      "574 C 5/26",
      "574 C 10/26",
    ]);
  });

  it("keeps only the filtered status", () => {
    const result = applyOverviewQuery(entries, { sort: "status", filter: "open" });
    expect(aktenzeichen(result)).toEqual(["574 C 2/26", "574 C 4/26"]);
  });

  it("returns nothing when no entry has the filtered status", () => {
    const result = applyOverviewQuery(entries.slice(0, 2), { sort: "status", filter: "draft" });
    expect(result).toEqual([]);
  });

  it("does not change the given list", () => {
    const copy = [...entries];
    applyOverviewQuery(entries, { sort: "aktenzeichen", filter: "none" });
    expect(entries).toEqual(copy);
  });
});
