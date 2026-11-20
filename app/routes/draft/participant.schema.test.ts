import { describe, expect, it } from "vitest";

import {
  MAX_PARTICIPANTS,
  parseParticipantForm,
  participantMessages,
  validateParticipant,
} from "./participant.schema";

const validate = (email: string, name = "", safeId = "") =>
  validateParticipant({ email, safeId, name });

function errorsOf(result: ReturnType<typeof validate>) {
  if (result.success) throw new Error("expected validation to fail");
  return result.errors;
}

describe("validateParticipant", () => {
  it("accepts an e-mail address without a name", () => {
    expect(validate("person.a@example.com")).toEqual({
      success: true,
      value: { email: "person.a@example.com", safeId: null, name: null },
    });
  });

  it("accepts a SAFE-ID without an e-mail address or a name", () => {
    expect(validate("", "", "DE.Example.a1")).toEqual({
      success: true,
      value: { email: null, safeId: "DE.Example.a1", name: null },
    });
  });

  it("accepts a SAFE-ID next to an e-mail address and a name", () => {
    expect(validate("person.a@example.com", "Person A", "DE.Example.a1")).toEqual({
      success: true,
      value: { email: "person.a@example.com", safeId: "DE.Example.a1", name: "Person A" },
    });
  });

  it("trims the SAFE-ID but keeps its case", () => {
    expect(validate("", "", "  DE.Example.A1  ")).toEqual({
      success: true,
      value: { email: null, safeId: "DE.Example.A1", name: null },
    });
  });

  it("accepts a name without an e-mail address, for a person who has none", () => {
    expect(validate("", "Person A")).toEqual({
      success: true,
      value: { email: null, safeId: null, name: "Person A" },
    });
  });

  it("accepts both", () => {
    expect(validate("person.a@example.com", "Person A")).toEqual({
      success: true,
      value: { email: "person.a@example.com", safeId: null, name: "Person A" },
    });
  });

  it("trims both and stores the address in lower case", () => {
    expect(validate("  Person.A@Example.COM ", "  Person A  ")).toEqual({
      success: true,
      value: { email: "person.a@example.com", safeId: null, name: "Person A" },
    });
  });

  it("asks for the e-mail address when there is no address, SAFE-ID or name", () => {
    expect(errorsOf(validate(""))).toEqual({ email: participantMessages.emailRequired });
    expect(errorsOf(validate("   ", "  ", "   "))).toEqual({
      email: participantMessages.emailRequired,
    });
  });

  it.each(["person", "person@", "@example.com", "person a@example.com", "person@example"])(
    "rejects %s as an e-mail address, also when there is a name",
    (email) => {
      expect(errorsOf(validate(email, "Person A"))).toEqual({
        email: participantMessages.emailInvalid,
      });
    },
  );

  it("rejects an address, a SAFE-ID or a name that is too long", () => {
    expect(validate("", "", "a".repeat(255)).success).toBe(true);
    expect(errorsOf(validate("", "", "a".repeat(256)))).toEqual({
      safeId: participantMessages.safeIdTooLong,
    });
    expect(errorsOf(validate(`${"a".repeat(250)}@example.com`)).email).toBe(
      participantMessages.emailTooLong,
    );
    expect(errorsOf(validate("person.a@example.com", "A".repeat(101))).name).toBe(
      participantMessages.nameTooLong,
    );
  });

  it("reports all fields at once", () => {
    expect(errorsOf(validate("nope", "A".repeat(101), "a".repeat(256)))).toEqual({
      email: participantMessages.emailInvalid,
      safeId: participantMessages.safeIdTooLong,
      name: participantMessages.nameTooLong,
    });
  });

  it("states the maximum in the message about too many people", () => {
    expect(participantMessages.tooManyParticipants).toContain(String(MAX_PARTICIPANTS));
  });
});

describe("parseParticipantForm", () => {
  it("reads all fields", () => {
    const form = new FormData();
    form.set("email", "person.a@example.com");
    form.set("safeId", "DE.Example.a1");
    form.set("name", "Person A");
    form.set("other", "x");

    expect(parseParticipantForm(form)).toEqual({
      email: "person.a@example.com",
      safeId: "DE.Example.a1",
      name: "Person A",
    });
  });

  it("falls back to empty fields, and ignores file uploads", () => {
    expect(parseParticipantForm(new FormData())).toEqual({ email: "", safeId: "", name: "" });
    const form = new FormData();
    form.set("email", new File(["x"], "x.txt"));
    expect(parseParticipantForm(form)).toEqual({ email: "", safeId: "", name: "" });
  });
});
