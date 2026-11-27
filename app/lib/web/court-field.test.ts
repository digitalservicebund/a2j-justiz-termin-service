import { describe, expect, it } from "vitest";

import { parseCourtField, wantsSaveAsDefault } from "./court-field.ts";
import { courtMessages } from "./court-form.ts";

describe("parseCourtField", () => {
  it("accepts a court of the dropdown", () => {
    expect(parseCourtField("B2402", { required: true })).toEqual({ code: "B2402" });
  });

  it("reads the empty option as no court when none is required", () => {
    expect(parseCourtField("", { required: false })).toEqual({ code: null });
    expect(parseCourtField(null, { required: false })).toEqual({ code: null });
  });

  it("asks for a court when one is required", () => {
    expect(parseCourtField("", { required: true })).toEqual({ problem: courtMessages.required });
    expect(parseCourtField(null, { required: true })).toEqual({ problem: courtMessages.required });
  });

  it.each([
    ["an unknown code", "Q0000"],
    ["a closed court", "R2710"],
    ["a Staatsanwaltschaft", "A1000S"],
  ])("rejects %s", (_, code) => {
    expect(parseCourtField(code, { required: false })).toEqual({ problem: courtMessages.invalid });
  });
});

describe("wantsSaveAsDefault", () => {
  it("is true only for a checked checkbox", () => {
    const checked = new FormData();
    checked.set("saveAsDefault", "on");
    expect(wantsSaveAsDefault(checked)).toBe(true);
    expect(wantsSaveAsDefault(new FormData())).toBe(false);
  });
});
