// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  isPayloadInvalid,
  isReceiverUnknown,
  isSafeId,
  PAYLOAD_INVALID_TYPE,
  RECEIVER_UNKNOWN_TYPE,
} from "./erv-versand-messages.ts";

describe("isSafeId", () => {
  it("accepts a SAFE-ID with country code, domain, UUID and check digits", () => {
    expect(isSafeId("DE.Justiz.71051095-c471-46e3-1760-56d2229c3bb2.a740")).toBe(true);
    expect(isSafeId("DE.Example_Domain-1.71051095-C471-46E3-1760-56D2229C3BB2.A740")).toBe(true);
  });

  it.each([
    ["an empty string", ""],
    ["another country code", "AT.Justiz.71051095-c471-46e3-1760-56d2229c3bb2.a740"],
    ["no domain", "DE..71051095-c471-46e3-1760-56d2229c3bb2.a740"],
    ["a domain with a dot", "DE.Jus.tiz.71051095-c471-46e3-1760-56d2229c3bb2.a740"],
    ["a malformed UUID", "DE.Justiz.71051095-c471-46e3-1760.a740"],
    ["non-hex characters in the UUID", "DE.Justiz.7105109z-c471-46e3-1760-56d2229c3bb2.a740"],
    ["three check digits", "DE.Justiz.71051095-c471-46e3-1760-56d2229c3bb2.a74"],
    ["five check digits", "DE.Justiz.71051095-c471-46e3-1760-56d2229c3bb2.a7400"],
    ["surrounding whitespace", " DE.Justiz.71051095-c471-46e3-1760-56d2229c3bb2.a740 "],
  ])("rejects %s", (_, value) => {
    expect(isSafeId(value)).toBe(false);
  });
});

describe("problem type guards", () => {
  const payloadInvalid = {
    type: PAYLOAD_INVALID_TYPE,
    title: "Payload Invalid",
    errors: [{ pointer: "#/receiver", detail: "must match pattern" }],
  };
  const receiverUnknown = { type: RECEIVER_UNKNOWN_TYPE, title: "Receiver Unknown" };
  const unknownProblem = { type: "https://example.com/problems/other", title: "Other" };

  it("recognizes an invalid payload by its type only", () => {
    expect(isPayloadInvalid(payloadInvalid)).toBe(true);
    expect(isPayloadInvalid(receiverUnknown)).toBe(false);
    expect(isPayloadInvalid(unknownProblem)).toBe(false);
    expect(isPayloadInvalid({ type: PAYLOAD_INVALID_TYPE, title: "Something else" })).toBe(true);
  });

  it("recognizes an unknown receiver by its type only", () => {
    expect(isReceiverUnknown(receiverUnknown)).toBe(true);
    expect(isReceiverUnknown(payloadInvalid)).toBe(false);
    expect(isReceiverUnknown(unknownProblem)).toBe(false);
  });
});
