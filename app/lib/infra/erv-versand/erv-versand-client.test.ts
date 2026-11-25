// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  type AmqpChannel,
  type AmqpMessage,
  createErvVersandClient,
  ErvVersandTimeoutError,
  MESSAGE_TYPES,
  type UncorrelatedReply,
} from "./erv-versand-client.ts";
import { PAYLOAD_INVALID_TYPE, RECEIVER_UNKNOWN_TYPE } from "./erv-versand-messages.ts";

const RECEIVER = "DE.Justiz.71051095-c471-46e3-1760-56d2229c3bb2.a740";

// An in-memory AMQP channel: records what the client publishes and lets a test deliver replies.
function fakeChannel() {
  let onMessage: ((message: AmqpMessage | null) => void) | undefined;
  const channel = {
    publish: vi.fn<AmqpChannel["publish"]>(() => true),
    consume: vi.fn<AmqpChannel["consume"]>(async (_queue, handler) => {
      onMessage = handler;
      return { consumerTag: "consumer-1" };
    }),
    cancel: vi.fn<AmqpChannel["cancel"]>(async () => undefined),
    ack: vi.fn<AmqpChannel["ack"]>(),
  };

  function lastPublished() {
    const [exchange, routingKey, content, properties] = channel.publish.mock.lastCall!;
    return { exchange, routingKey, payload: JSON.parse(content.toString("utf8")), properties };
  }

  function deliver(properties: AmqpMessage["properties"], content: string | object): AmqpMessage {
    const message = {
      content: Buffer.from(typeof content === "string" ? content : JSON.stringify(content)),
      properties,
    };
    onMessage!(message);
    return message;
  }

  function cancelByBroker() {
    onMessage!(null);
  }

  return { channel, lastPublished, deliver, cancelByBroker };
}

async function setUp(options: { timeoutInMilliseconds?: number } = {}) {
  const fake = fakeChannel();
  const onUncorrelatedReply = vi.fn<(reply: UncorrelatedReply) => void>();
  const client = await createErvVersandClient({
    channel: fake.channel,
    userId: "jts",
    onUncorrelatedReply,
    ...options,
  });
  return { ...fake, client, onUncorrelatedReply };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createErvVersandClient", () => {
  it("consumes its own reply queue with manual acknowledgement", async () => {
    const { channel } = await setUp();

    expect(channel.consume).toHaveBeenCalledOnce();
    expect(channel.consume).toHaveBeenCalledWith("replies.jts", expect.any(Function), {
      noAck: false,
    });
  });

  it("publishes a request with native AMQP properties", async () => {
    const { client, lastPublished } = await setUp();

    void client.sendEgvpMessage({ receiver: RECEIVER, xjustizMessage: { content: "PHhtbC8+" } });

    const { exchange, routingKey, payload, properties } = lastPublished();
    expect(exchange).toBe("requests");
    expect(routingKey).toBe("requests");
    expect(payload).toEqual({ receiver: RECEIVER, xjustizMessage: { content: "PHhtbC8+" } });
    expect(properties).toEqual({
      correlationId: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-/),
      userId: "jts",
      type: MESSAGE_TYPES.sendEgvpMessage,
      contentType: "application/json",
      persistent: true,
    });
  });

  it("gives every request its own correlation ID", async () => {
    const { client, channel } = await setUp();

    void client.sendEgvpMessage({ receiver: RECEIVER, xjustizMessage: { content: "" } });
    void client.sendEgvpMessage({ receiver: RECEIVER, xjustizMessage: { content: "" } });

    const [first, second] = channel.publish.mock.calls.map(([, , , options]) => options);
    expect(first!.correlationId).not.toBe(second!.correlationId);
  });

  it("sends the example message with its own message type", async () => {
    const { client, lastPublished } = await setUp();

    void client.sendEgvpExampleMessage({ receiver: RECEIVER });

    expect(lastPublished().payload).toEqual({ receiver: RECEIVER });
    expect(lastPublished().properties.type).toBe(MESSAGE_TYPES.sendEgvpExampleMessage);
  });

  it("resolves as sent when the matching reply arrives, and acknowledges it", async () => {
    const { client, channel, lastPublished, deliver, onUncorrelatedReply } = await setUp();

    const result = client.sendEgvpMessage({ receiver: RECEIVER, xjustizMessage: { content: "" } });
    const { correlationId } = lastPublished().properties;
    const reply = deliver({ correlationId, type: MESSAGE_TYPES.egvpMessageSent }, {});

    await expect(result).resolves.toEqual({ outcome: "sent", reply: {} });
    expect(channel.ack).toHaveBeenCalledWith(reply);
    expect(onUncorrelatedReply).not.toHaveBeenCalled();
  });

  it("matches replies to requests by correlation ID, in any order", async () => {
    const { client, channel, deliver } = await setUp();

    const first = client.sendEgvpMessage({ receiver: RECEIVER, xjustizMessage: { content: "" } });
    const second = client.sendEgvpExampleMessage({ receiver: RECEIVER });
    const [firstId, secondId] = channel.publish.mock.calls.map(
      ([, , , options]) => options.correlationId,
    );

    const problem = { type: RECEIVER_UNKNOWN_TYPE, title: "Receiver Unknown" };
    deliver({ correlationId: secondId, type: MESSAGE_TYPES.sendEgvpExampleMessageFailed }, problem);
    deliver({ correlationId: firstId, type: MESSAGE_TYPES.egvpMessageSent }, {});

    await expect(first).resolves.toEqual({ outcome: "sent", reply: {} });
    await expect(second).resolves.toEqual({ outcome: "failed", problem });
  });

  it("resolves a failure reply as failed with its problem", async () => {
    const { client, lastPublished, deliver } = await setUp();

    const result = client.sendEgvpMessage({ receiver: RECEIVER, xjustizMessage: { content: "" } });
    const problem = {
      type: PAYLOAD_INVALID_TYPE,
      title: "Payload Invalid",
      errors: [{ pointer: "#/receiver", detail: "must match pattern" }],
    };
    deliver(
      {
        correlationId: lastPublished().properties.correlationId,
        type: MESSAGE_TYPES.sendEgvpMessageFailed,
      },
      problem,
    );

    await expect(result).resolves.toEqual({ outcome: "failed", problem });
  });

  it("resolves any problem+json reply as failed, whatever its message type", async () => {
    const { client, lastPublished, deliver } = await setUp();

    const result = client.sendEgvpMessage({ receiver: RECEIVER, xjustizMessage: { content: "" } });
    const problem = { type: "https://example.com/problems/new", title: "New Problem" };
    deliver(
      {
        correlationId: lastPublished().properties.correlationId,
        type: "de.justiz.basisdienst.erv.some-future-reply.v1",
        contentType: "application/problem+json",
      },
      problem,
    );

    await expect(result).resolves.toEqual({ outcome: "failed", problem });
  });

  it("rejects on a reply of an unexpected message type, and still acknowledges it", async () => {
    const { client, channel, lastPublished, deliver } = await setUp();

    const result = client.sendEgvpMessage({ receiver: RECEIVER, xjustizMessage: { content: "" } });
    const reply = deliver(
      { correlationId: lastPublished().properties.correlationId, type: "unexpected.v1" },
      {},
    );

    await expect(result).rejects.toThrow("Unexpected reply message type: unexpected.v1");
    expect(channel.ack).toHaveBeenCalledWith(reply);
  });

  it("rejects when the matching reply is not valid JSON", async () => {
    const { client, channel, lastPublished, deliver } = await setUp();

    const result = client.sendEgvpMessage({ receiver: RECEIVER, xjustizMessage: { content: "" } });
    const reply = deliver(
      {
        correlationId: lastPublished().properties.correlationId,
        type: MESSAGE_TYPES.egvpMessageSent,
      },
      "not json",
    );

    await expect(result).rejects.toThrow("Reply payload is not valid JSON.");
    expect(channel.ack).toHaveBeenCalledWith(reply);
  });

  it("hands replies without a pending request to onUncorrelatedReply and acknowledges them", async () => {
    const { channel, deliver, onUncorrelatedReply } = await setUp();

    const unknown = deliver({ correlationId: "unknown", type: MESSAGE_TYPES.egvpMessageSent }, {});
    const missing = deliver({ type: MESSAGE_TYPES.sendEgvpMessageFailed }, { type: "x" });
    const invalid = deliver({ correlationId: "other", type: "y" }, "not json");

    expect(onUncorrelatedReply.mock.calls).toEqual([
      [{ correlationId: "unknown", messageType: MESSAGE_TYPES.egvpMessageSent, payload: {} }],
      [
        {
          correlationId: undefined,
          messageType: MESSAGE_TYPES.sendEgvpMessageFailed,
          payload: { type: "x" },
        },
      ],
      [{ correlationId: "other", messageType: "y", payload: "not json" }],
    ]);
    expect(channel.ack.mock.calls).toEqual([[unknown], [missing], [invalid]]);
  });

  it("acknowledges an uncorrelated reply only after onUncorrelatedReply returned", async () => {
    const { channel, deliver, onUncorrelatedReply } = await setUp();
    onUncorrelatedReply.mockImplementation(() => {
      expect(channel.ack).not.toHaveBeenCalled();
    });

    deliver({ correlationId: "unknown", type: MESSAGE_TYPES.egvpMessageSent }, {});

    expect(onUncorrelatedReply).toHaveBeenCalledOnce();
    expect(channel.ack).toHaveBeenCalledOnce();
  });

  it("rejects with a timeout error after 5 minutes by default", async () => {
    vi.useFakeTimers();
    const { client, lastPublished } = await setUp();

    const result = client.sendEgvpMessage({ receiver: RECEIVER, xjustizMessage: { content: "" } });
    const { correlationId } = lastPublished().properties;
    const settled = vi.fn();
    result.catch(settled);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 - 1);
    expect(settled).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    const error = await result.catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ErvVersandTimeoutError);
    expect(error).toMatchObject({ name: "ErvVersandTimeoutError", correlationId });
    expect((error as Error).message).toContain(MESSAGE_TYPES.sendEgvpMessage);
  });

  it("uses a custom timeout and treats a late reply as uncorrelated", async () => {
    vi.useFakeTimers();
    const { client, lastPublished, deliver, onUncorrelatedReply } = await setUp({
      timeoutInMilliseconds: 1000,
    });

    const result = client.sendEgvpMessage({ receiver: RECEIVER, xjustizMessage: { content: "" } });
    const { correlationId } = lastPublished().properties;
    const error = result.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await error).toBeInstanceOf(ErvVersandTimeoutError);

    deliver({ correlationId, type: MESSAGE_TYPES.egvpMessageSent }, {});
    expect(onUncorrelatedReply).toHaveBeenCalledWith({
      correlationId,
      messageType: MESSAGE_TYPES.egvpMessageSent,
      payload: {},
    });
  });

  it("clears the timeout once the reply arrived", async () => {
    vi.useFakeTimers();
    const { client, lastPublished, deliver } = await setUp();

    const result = client.sendEgvpMessage({ receiver: RECEIVER, xjustizMessage: { content: "" } });
    deliver(
      {
        correlationId: lastPublished().properties.correlationId,
        type: MESSAGE_TYPES.egvpMessageSent,
      },
      {},
    );

    await expect(result).resolves.toMatchObject({ outcome: "sent" });
    expect(vi.getTimerCount()).toBe(0);
  });

  it("rejects all pending requests when the broker cancels the consumer", async () => {
    const { client, cancelByBroker } = await setUp();

    const first = client.sendEgvpMessage({ receiver: RECEIVER, xjustizMessage: { content: "" } });
    const second = client.sendEgvpExampleMessage({ receiver: RECEIVER });
    cancelByBroker();

    await expect(first).rejects.toThrow("Reply queue consumer was cancelled by the broker.");
    await expect(second).rejects.toThrow("Reply queue consumer was cancelled by the broker.");
  });

  it("stops consuming and rejects pending requests on close", async () => {
    vi.useFakeTimers();
    const { client, channel } = await setUp();

    const result = client.sendEgvpMessage({ receiver: RECEIVER, xjustizMessage: { content: "" } });
    const error = result.catch((error: unknown) => error);
    await client.close();

    expect(await error).toEqual(new Error("ERV Versand client was closed."));
    expect(channel.cancel).toHaveBeenCalledWith("consumer-1");
    expect(vi.getTimerCount()).toBe(0);
  });
});
