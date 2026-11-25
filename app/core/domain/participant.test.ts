import { describe, expect, it } from "vitest";

import { givenName } from "./participant.ts";

describe("givenName", () => {
  it("is the name the judge gave", () => {
    expect(givenName({ name: "Person A", email: "person.a@example.com", safeId: null })).toBe(
      "Person A",
    );
  });

  it("is null where the name only falls back to the e-mail address or SAFE-ID", () => {
    expect(
      givenName({ name: "person.a@example.com", email: "person.a@example.com", safeId: null }),
    ).toBeNull();
    expect(givenName({ name: "DE.Example.1", email: null, safeId: "DE.Example.1" })).toBeNull();
  });
});
