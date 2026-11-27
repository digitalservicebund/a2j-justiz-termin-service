import { describe, expect, it } from "vitest";

import { courtGroups, courtName, isPickableCourt } from "./court.ts";

const allCodes = () => courtGroups.flatMap(({ courts }) => courts.map(({ code }) => code));

describe("courtName", () => {
  it("names a court by its code", () => {
    expect(courtName("B2402")).toBe("Amtsgericht Biberach an der Riß");
  });

  it("names a closed court without the prefix of the code list", () => {
    expect(courtName("R2710")).toBe("Amtsgericht Haltern");
  });

  it("shows a code the list does not know as it is", () => {
    expect(courtName("Q0000")).toBe("Q0000");
  });

  it("has no name without a code", () => {
    expect(courtName(null)).toBeUndefined();
    expect(courtName(undefined)).toBeUndefined();
    expect(courtName("")).toBeUndefined();
  });
});

describe("isPickableCourt", () => {
  it("accepts an open court", () => {
    expect(isPickableCourt("B2402")).toBe(true);
    expect(isPickableCourt("A1000")).toBe(true);
  });

  it.each([
    ["a closed court", "R2710"],
    ["a test entry", "9B0000"],
    ["a Staatsanwaltschaft", "A1000S"],
    ["a Grundbuchamt", "B1101G"],
    ["an unknown code", "Q0000"],
    ["an empty code", ""],
  ])("rejects %s", (_, code) => {
    expect(isPickableCourt(code)).toBe(false);
  });
});

describe("courtGroups", () => {
  it("offers exactly the courts that can be picked", () => {
    const codes = allCodes();
    expect(codes.length).toBeGreaterThan(1000);
    expect(new Set(codes).size).toBe(codes.length);
    expect(codes.every(isPickableCourt)).toBe(true);
    expect(codes).not.toContain("R2710");
    expect(codes).not.toContain("A1000S");
  });

  it("groups by Bundesland, with the Bund first and the Länder by name", () => {
    const labels = courtGroups.map(({ label }) => label);
    expect(labels[0]).toBe("Bund");
    expect(labels).toContain("Nordrhein-Westfalen");
    expect(labels).not.toContain("Sonstige");
    const states = labels.slice(1);
    expect(states).toEqual([...states].sort((a, b) => a.localeCompare(b, "de")));
  });

  it("puts a court into the group of its Bundesland, sorted by name", () => {
    const bayern = courtGroups.find(({ label }) => label === "Bayern");
    expect(bayern?.courts.map(({ code }) => code)).toContain("D2000");
    const names = bayern?.courts.map(({ name }) => name) ?? [];
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "de")));
  });
});
