import { describe, expect, it } from "vitest";

import {
  MAX_PARTICIPANTS,
  parseParticipantForm,
  participantMessages,
  validateParticipant,
} from "../create-termin.participant.schema";

const validate = (email: string, name = "") => validateParticipant({ email, name });

function errorsOf(result: ReturnType<typeof validate>) {
  if (result.success) throw new Error("expected validation to fail");
  return result.errors;
}

describe("validateParticipant", () => {
  it("accepts an e-mail address without a name", () => {
    expect(validate("person.a@example.com")).toEqual({
      success: true,
      value: { email: "person.a@example.com", name: null },
    });
  });

  it("accepts a name without an e-mail address, for a person who has none", () => {
    expect(validate("", "Person A")).toEqual({
      success: true,
      value: { email: null, name: "Person A" },
    });
  });

  it("accepts both", () => {
    expect(validate("person.a@example.com", "Person A")).toEqual({
      success: true,
      value: { email: "person.a@example.com", name: "Person A" },
    });
  });

  it("trims both and stores the address in lower case", () => {
    expect(validate("  Person.A@Example.COM ", "  Person A  ")).toEqual({
      success: true,
      value: { email: "person.a@example.com", name: "Person A" },
    });
  });

  it("asks for the e-mail address when there is neither address nor name", () => {
    expect(errorsOf(validate(""))).toEqual({ email: participantMessages.emailRequired });
    expect(errorsOf(validate("   ", "  "))).toEqual({ email: participantMessages.emailRequired });
  });

  it.each(["person", "person@", "@example.com", "person a@example.com", "person@example"])(
    "rejects %s as an e-mail address, also when there is a name",
    (email) => {
      expect(errorsOf(validate(email, "Person A"))).toEqual({
        email: participantMessages.emailInvalid,
      });
    },
  );

  it("rejects an address or a name that is too long", () => {
    expect(errorsOf(validate(`${"a".repeat(250)}@example.com`)).email).toBe(
      participantMessages.emailTooLong,
    );
    expect(errorsOf(validate("person.a@example.com", "A".repeat(101))).name).toBe(
      participantMessages.nameTooLong,
    );
  });

  it("reports both fields at once", () => {
    expect(errorsOf(validate("nope", "A".repeat(101)))).toEqual({
      email: participantMessages.emailInvalid,
      name: participantMessages.nameTooLong,
    });
  });

  it("states the maximum in the message about too many people", () => {
    expect(participantMessages.tooManyParticipants).toContain(String(MAX_PARTICIPANTS));
  });
});

describe("parseParticipantForm", () => {
  it("reads both fields", () => {
    const form = new FormData();
    form.set("email", "person.a@example.com");
    form.set("name", "Person A");
    form.set("other", "x");

    expect(parseParticipantForm(form)).toEqual({ email: "person.a@example.com", name: "Person A" });
  });

  it("falls back to empty fields, and ignores file uploads", () => {
    expect(parseParticipantForm(new FormData())).toEqual({ email: "", name: "" });
    const form = new FormData();
    form.set("email", new File(["x"], "x.txt"));
    expect(parseParticipantForm(form)).toEqual({ email: "", name: "" });
  });
});
