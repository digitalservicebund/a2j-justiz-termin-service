import { describe, expect, it } from "vitest";

import { AllowedDomainSchema, emailDomain } from "../allowed-domain";

describe("AllowedDomainSchema", () => {
  it.each([
    [" Example.COM ", "example.com"],
    ["court-x.example.com", "court-x.example.com"],
  ])("normalizes %s", (input, expected) => {
    expect(AllowedDomainSchema.parse(input)).toBe(expected);
  });

  it.each([
    "",
    "example",
    "person@example.com",
    "@example.com",
    "https://example.com",
    "example.com/path",
    "exa mple.com",
    "-example.com",
    "example..com",
    "example.c",
  ])("rejects %j", (input) => {
    expect(AllowedDomainSchema.safeParse(input).success).toBe(false);
  });

  it("rejects a non-string value", () => {
    expect(AllowedDomainSchema.safeParse(null).success).toBe(false);
  });
});

describe("emailDomain", () => {
  it("returns the lowercase part after the last @", () => {
    expect(emailDomain("Person.A@Example.COM")).toBe("example.com");
    expect(emailDomain("odd@name@example.com")).toBe("example.com");
  });
});
