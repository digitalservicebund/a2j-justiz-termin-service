// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

import {
  type AmqpChannel,
  type AmqpMessage,
  createErvVersandClient,
  type ErvVersandReply,
  MESSAGE_TYPES,
} from "./erv-versand-client.ts";
import { PAYLOAD_INVALID_TYPE, RECEIVER_UNKNOWN_TYPE } from "./erv-versand-messages.ts";

const RECEIVER = "DE.Justiz.71051095-c471-46e3-1760-56d2229c3bb2.a740";
const egvpMessage = { receiver: RECEIVER, xjustizMessage: { content: "PHhtbC8+" } } as const;

// An in-memory AMQP confirm channel: records what the client publishes and lets a test deliver
// replies.
function fakeChannel() {
  let onMessage: ((message: AmqpMessage | null) => void) | undefined;
  const channel = {
    publish: vi.fn<AmqpChannel["publish"]>(() => true),
    waitForConfirms: vi.fn<AmqpChannel["waitForConfirms"]>(async () => {}),
    consume: vi.fn<AmqpChannel["consume"]>(async (_queue, handler) => {
      onMessage = handler;
      return { consumerTag: "consumer-1" };
    }),
    cancel: vi.fn<AmqpChannel["cancel"]>(async () => undefined),
    ack: vi.fn<AmqpChannel["ack"]>(),
    nack: vi.fn<AmqpChannel["nack"]>(),
  };

  function deliver(
    properties: AmqpMessage["properties"],
    content: string | object,
    redelivered = false,
  ): AmqpMessage {
    const message = {
      content: Buffer.from(typeof content === "string" ? content : JSON.stringify(content)),
      fields: { redelivered },
      properties,
    };
    onMessage!(message);
    return message;
  }

  return { channel, deliver, cancelByBroker: () => onMessage!(null) };
}

async function setUp(onReply = vi.fn<(reply: ErvVersandReply) => Promise<void>>(async () => {})) {
  const fake = fakeChannel();
  const onCancel = vi.fn();
  const client = await createErvVersandClient({
    channel: fake.channel,
    userId: "jts",
    onReply,
    onCancel,
  });
  return { ...fake, client, onReply, onCancel };
}

// A promise the test resolves when it wants to.
function deferred() {
  let resolve: (() => void) | undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve: () => resolve?.() };
}

// Lets the promise callbacks of a delivered reply run.
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe("createErvVersandClient", () => {
  it("consumes its own reply queue with manual acknowledgement", async () => {
    const { channel } = await setUp();

    expect(channel.consume).toHaveBeenCalledOnce();
    expect(channel.consume).toHaveBeenCalledWith("replies.jts", expect.any(Function), {
      noAck: false,
    });
  });

  it("publishes a request with the given correlation ID as native AMQP properties", async () => {
    const { client, channel } = await setUp();

    await client.sendEgvpMessage(egvpMessage, "c1");

    const [exchange, routingKey, content, properties] = channel.publish.mock.lastCall!;
    expect(exchange).toBe("requests");
    expect(routingKey).toBe("requests");
    expect(JSON.parse(content.toString("utf8"))).toEqual(egvpMessage);
    expect(properties).toEqual({
      correlationId: "c1",
      userId: "jts",
      type: MESSAGE_TYPES.sendEgvpMessage,
      contentType: "application/json",
      persistent: true,
    });
  });

  it("sends the example message with its own message type", async () => {
    const { client, channel } = await setUp();

    await client.sendEgvpExampleMessage({ receiver: RECEIVER }, "c2");

    expect(channel.publish.mock.lastCall![3]).toMatchObject({
      correlationId: "c2",
      type: MESSAGE_TYPES.sendEgvpExampleMessage,
    });
  });

  it("resolves only once the broker confirmed the request", async () => {
    const { client, channel } = await setUp();
    const confirmation = deferred();
    channel.waitForConfirms.mockReturnValue(confirmation.promise);
    const resolved = vi.fn();

    const sending = client.sendEgvpMessage(egvpMessage, "c1").then(resolved);
    await settle();
    expect(resolved).not.toHaveBeenCalled();

    confirmation.resolve();
    await sending;
    expect(resolved).toHaveBeenCalledOnce();
  });

  it("rejects when the broker does not confirm the request", async () => {
    const { client, channel } = await setUp();
    channel.waitForConfirms.mockRejectedValue(new Error("nacked"));

    await expect(client.sendEgvpMessage(egvpMessage, "c1")).rejects.toThrow("nacked");
  });

  it("hands a sent reply to onReply, then acknowledges it", async () => {
    const { channel, deliver, onReply } = await setUp();

    const message = deliver({ correlationId: "c1", type: MESSAGE_TYPES.egvpMessageSent }, {});
    await settle();

    expect(onReply).toHaveBeenCalledWith({
      correlationId: "c1",
      messageType: MESSAGE_TYPES.egvpMessageSent,
      outcome: { kind: "sent", reply: {} },
    });
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it("acknowledges a reply only after onReply finished", async () => {
    const handled = deferred();
    const { channel, deliver } = await setUp(vi.fn(() => handled.promise));

    deliver({ correlationId: "c1", type: MESSAGE_TYPES.egvpMessageSent }, {});
    await settle();
    expect(channel.ack).not.toHaveBeenCalled();

    handled.resolve();
    await settle();
    expect(channel.ack).toHaveBeenCalledOnce();
  });

  it("hands a failure reply over with its problem", async () => {
    const { deliver, onReply } = await setUp();
    const problem = {
      type: PAYLOAD_INVALID_TYPE,
      title: "Payload Invalid",
      errors: [{ pointer: "#/receiver", detail: "must match pattern" }],
    };

    deliver({ correlationId: "c1", type: MESSAGE_TYPES.sendEgvpMessageFailed }, problem);
    await settle();

    expect(onReply).toHaveBeenCalledWith({
      correlationId: "c1",
      messageType: MESSAGE_TYPES.sendEgvpMessageFailed,
      outcome: { kind: "failed", problem },
    });
  });

  it("treats any problem+json reply as a failure, whatever its message type", async () => {
    const { deliver, onReply } = await setUp();
    const problem = { type: RECEIVER_UNKNOWN_TYPE, title: "Receiver Unknown" };

    deliver(
      { correlationId: "c1", type: "future.v1", contentType: "application/problem+json" },
      problem,
    );
    await settle();

    expect(onReply.mock.lastCall![0].outcome).toEqual({ kind: "failed", problem });
  });

  it("hands over a reply of an unexpected type or without JSON as unreadable", async () => {
    const { channel, deliver, onReply } = await setUp();

    deliver({ correlationId: "c1", type: "unexpected.v1" }, {});
    deliver({ correlationId: "c2", type: MESSAGE_TYPES.egvpMessageSent }, "not json");
    deliver({ type: MESSAGE_TYPES.egvpMessageSent }, {});
    await settle();

    expect(onReply.mock.calls.map(([reply]) => reply)).toEqual([
      {
        correlationId: "c1",
        messageType: "unexpected.v1",
        outcome: { kind: "unreadable", reason: "Unexpected reply message type: unexpected.v1" },
      },
      {
        correlationId: "c2",
        messageType: MESSAGE_TYPES.egvpMessageSent,
        outcome: { kind: "unreadable", reason: "Reply payload is not valid JSON." },
      },
      {
        correlationId: undefined,
        messageType: MESSAGE_TYPES.egvpMessageSent,
        outcome: { kind: "sent", reply: {} },
      },
    ]);
    expect(channel.ack).toHaveBeenCalledTimes(3);
  });

  it("offers a reply once more when onReply fails, then drops it", async () => {
    const { channel, deliver } = await setUp(vi.fn(async () => Promise.reject(new Error("db"))));

    const first = deliver({ correlationId: "c1", type: MESSAGE_TYPES.egvpMessageSent }, {});
    const again = deliver({ correlationId: "c1", type: MESSAGE_TYPES.egvpMessageSent }, {}, true);
    await settle();

    expect(channel.ack).not.toHaveBeenCalled();
    expect(channel.nack.mock.calls).toEqual([
      [first, false, true],
      [again, false, false],
    ]);
  });

  it("tells when the broker cancels the consumer", async () => {
    const { cancelByBroker, onCancel, onReply } = await setUp();

    cancelByBroker();

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onReply).not.toHaveBeenCalled();
  });

  it("stops consuming on close", async () => {
    const { client, channel } = await setUp();

    await client.close();

    expect(channel.cancel).toHaveBeenCalledWith("consumer-1");
  });
});
