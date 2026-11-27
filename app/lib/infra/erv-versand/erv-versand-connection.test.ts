// @vitest-environment node
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { log } from "../logging.ts";
import { connectRabbitMq } from "../rabbitmq.ts";
import { createErvVersandClient, type ErvVersandClient } from "./erv-versand-client.ts";
import { ervVersandClient, startErvVersand, stopErvVersand } from "./erv-versand-connection.ts";

vi.mock("../logging.ts", async () => (await import("~tests/logging")).loggingMock());
vi.mock("../rabbitmq.ts", () => ({ connectRabbitMq: vi.fn() }));
vi.mock("./erv-versand-client.ts", () => ({ createErvVersandClient: vi.fn() }));

// A connection that can be closed from the outside, like amqplib's.
class FakeConnection extends EventEmitter {
  readonly channel = new EventEmitter();
  createConfirmChannel = vi.fn(async () => this.channel);
  close = vi.fn(async () => {
    this.emit("close");
  });
}

const client = (): ErvVersandClient => ({
  sendEgvpMessage: vi.fn(),
  sendEgvpExampleMessage: vi.fn(),
  close: vi.fn(),
});

const onReply = vi.fn(async () => {});
let connections: FakeConnection[];

const connectionLike = (connection: FakeConnection) =>
  connection as unknown as Awaited<ReturnType<typeof connectRabbitMq>>;

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubEnv("SECRETS_FILE_PATH", "");
  vi.stubEnv("RABBITMQ_USER", "jts");
  connections = [];
  vi.mocked(connectRabbitMq).mockImplementation(async () => {
    const connection = new FakeConnection();
    connections.push(connection);
    return connectionLike(connection);
  });
  vi.mocked(createErvVersandClient).mockImplementation(async () => client());
});

afterEach(async () => {
  await stopErvVersand();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("startErvVersand", () => {
  it("connects once and consumes the replies with the handler", async () => {
    startErvVersand(onReply);
    const first = await ervVersandClient();
    startErvVersand(vi.fn());

    expect(await ervVersandClient()).toBe(first);
    expect(connectRabbitMq).toHaveBeenCalledOnce();
    expect(createErvVersandClient).toHaveBeenCalledWith({
      channel: connections[0]!.channel,
      userId: "jts",
      onReply,
      onCancel: expect.any(Function),
    });
  });

  it("logs errors the broker closes the channel with, instead of crashing", async () => {
    startErvVersand(onReply);
    await ervVersandClient();
    const missingQueue = Object.assign(new Error("NOT_FOUND"), { code: 404 });

    connections[0]!.channel.emit("error", missingQueue);

    expect(log.error).toHaveBeenCalledWith({ err: missingQueue }, "ERV Versand channel failed");
  });

  it("starts a new connection when the broker closes the channel", async () => {
    startErvVersand(onReply);
    const first = await ervVersandClient();

    connections[0]!.channel.emit("close");
    await vi.advanceTimersByTimeAsync(1000);

    expect(connections[0]!.close).toHaveBeenCalled();
    expect(connectRabbitMq).toHaveBeenCalledTimes(2);
    expect(await ervVersandClient()).not.toBe(first);
  });

  it("opens one connection for requests that come at the same time", async () => {
    startErvVersand(onReply);

    const [a, b] = await Promise.all([ervVersandClient(), ervVersandClient()]);

    expect(a).toBe(b);
    expect(connectRabbitMq).toHaveBeenCalledOnce();
  });

  it("reconnects after the connection closed", async () => {
    startErvVersand(onReply);
    const first = await ervVersandClient();

    connections[0]!.emit("close");
    await vi.advanceTimersByTimeAsync(1000);

    expect(connectRabbitMq).toHaveBeenCalledTimes(2);
    expect(await ervVersandClient()).not.toBe(first);
  });

  it("keeps trying while the broker cannot be reached, waiting longer each time", async () => {
    vi.mocked(connectRabbitMq).mockRejectedValue(new Error("ECONNREFUSED"));

    startErvVersand(onReply);
    await vi.advanceTimersByTimeAsync(0);
    expect(connectRabbitMq).toHaveBeenCalledTimes(1);
    expect(log.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "could not connect to the ERV Versand",
    );

    await vi.advanceTimersByTimeAsync(1000);
    expect(connectRabbitMq).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1999);
    expect(connectRabbitMq).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(connectRabbitMq).toHaveBeenCalledTimes(3);
  });

  it("closes the connection when the consumer cannot start", async () => {
    vi.mocked(createErvVersandClient).mockRejectedValueOnce(new Error("NOT_FOUND"));
    startErvVersand(onReply);

    await expect(ervVersandClient()).rejects.toThrow("NOT_FOUND");
    expect(connections[0]!.close).toHaveBeenCalled();
  });

  it("starts a new connection when the broker cancels the consumer", async () => {
    startErvVersand(onReply);
    await ervVersandClient();
    const { onCancel } = vi.mocked(createErvVersandClient).mock.calls[0]![0];

    onCancel!();
    await vi.advanceTimersByTimeAsync(1000);

    expect(connections[0]!.close).toHaveBeenCalled();
    expect(connectRabbitMq).toHaveBeenCalledTimes(2);
  });
});

describe("ervVersandClient", () => {
  it("rejects when the ERV Versand was not started", async () => {
    await expect(ervVersandClient()).rejects.toThrow("The ERV Versand was not started.");
    expect(connectRabbitMq).not.toHaveBeenCalled();
  });
});

describe("stopErvVersand", () => {
  it("closes the connection and does not reconnect", async () => {
    startErvVersand(onReply);
    await ervVersandClient();

    await stopErvVersand();
    await vi.advanceTimersByTimeAsync(60_000);

    expect(connections[0]!.close).toHaveBeenCalled();
    expect(connectRabbitMq).toHaveBeenCalledOnce();
  });
});
