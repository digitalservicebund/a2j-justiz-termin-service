// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { MESSAGE_TYPES, type ErvVersandReply } from "../infra/erv-versand/erv-versand-client.ts";
import {
  PAYLOAD_INVALID_TYPE,
  RECEIVER_UNKNOWN_TYPE,
} from "../infra/erv-versand/erv-versand-messages.ts";
import { logError, logInfo } from "../infra/logging.ts";
import { ervReplyHandler, settlementOf } from "./erv-replies.ts";

vi.mock("../infra/logging.ts", () => ({ logInfo: vi.fn(), logError: vi.fn() }));

const SAFE_ID = "DE.Example.00000000-0000-4000-8000-000000000001.0001";

const reply = (outcome: ErvVersandReply["outcome"], correlationId?: string): ErvVersandReply => ({
  correlationId,
  messageType: MESSAGE_TYPES.sendEgvpMessageFailed,
  outcome,
});

const sent = reply({ kind: "sent", reply: {} }, "c1");
const unknownReceiver = reply(
  {
    kind: "failed",
    problem: { type: RECEIVER_UNKNOWN_TYPE, title: "Receiver Unknown", detail: SAFE_ID },
  },
  "c1",
);

const logged = () =>
  JSON.stringify([...vi.mocked(logInfo).mock.calls, ...vi.mocked(logError).mock.calls]);

afterEach(() => {
  vi.clearAllMocks();
});

describe("settlementOf", () => {
  it("is sent for a sent reply", () => {
    expect(settlementOf(sent)).toEqual({ status: "sent" });
  });

  it("keeps the problem type of a failure, without its details", () => {
    expect(settlementOf(unknownReceiver)).toEqual({
      status: "failed",
      failure: RECEIVER_UNKNOWN_TYPE,
    });
  });

  it("keeps where an invalid payload is wrong", () => {
    const settlement = settlementOf(
      reply({
        kind: "failed",
        problem: {
          type: PAYLOAD_INVALID_TYPE,
          title: "Payload Invalid",
          errors: [
            { pointer: "#/receiver", detail: `${SAFE_ID} is not allowed` },
            { pointer: "#/attachments/0/name", detail: "too long" },
          ],
        },
      }),
    );

    expect(settlement).toEqual({
      status: "failed",
      failure: `${PAYLOAD_INVALID_TYPE} at #/receiver, #/attachments/0/name`,
    });
  });

  it("is failed with the reason for an unreadable reply", () => {
    expect(settlementOf(reply({ kind: "unreadable", reason: "Not JSON." }))).toEqual({
      status: "failed",
      failure: "Not JSON.",
    });
  });
});

describe("ervReplyHandler", () => {
  it("settles the invitation with the reply's correlation ID", async () => {
    const settle = vi.fn(async () => true);

    await ervReplyHandler(settle)(sent);
    await ervReplyHandler(settle)(unknownReceiver);

    expect(settle.mock.calls).toEqual([
      ["c1", { status: "sent" }],
      ["c1", { status: "failed", failure: RECEIVER_UNKNOWN_TYPE }],
    ]);
    expect(logInfo).toHaveBeenCalledWith("ERV invitation sent (correlation ID c1)");
    expect(logError).toHaveBeenCalledWith(
      `ERV invitation not delivered (correlation ID c1): ${RECEIVER_UNKNOWN_TYPE}`,
    );
    expect(logged()).not.toContain(SAFE_ID);
  });

  it("only logs a reply that matches no pending invitation", async () => {
    const settle = vi.fn(async () => false);

    await ervReplyHandler(settle)(sent);

    expect(logInfo).toHaveBeenCalledWith(
      `ERV reply ${MESSAGE_TYPES.sendEgvpMessageFailed} (correlation ID c1) matches no pending invitation`,
    );
  });

  it("ignores a reply without a correlation ID", async () => {
    const settle = vi.fn(async () => true);

    await ervReplyHandler(settle)(reply({ kind: "sent", reply: {} }));

    expect(settle).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      `ERV reply ${MESSAGE_TYPES.sendEgvpMessageFailed} without a correlation ID ignored`,
    );
  });

  it("fails when the invitation cannot be settled, so the reply is offered again", async () => {
    const settle = vi.fn(async () => Promise.reject(new Error("database down")));

    await expect(ervReplyHandler(settle)(sent)).rejects.toThrow("database down");
  });
});
