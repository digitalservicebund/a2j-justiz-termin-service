import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logError, logInfo } from "~/lib/infra/logging";
import { connectRabbitMq } from "~/lib/infra/rabbitmq";

import { loader } from "./rabbitmq";

vi.mock("~/lib/infra/rabbitmq", () => ({ connectRabbitMq: vi.fn() }));
vi.mock("~/lib/infra/logging", () => ({ logInfo: vi.fn(), logError: vi.fn() }));

// A connection whose channel answers the check of the reply queue with `checkQueue`.
function connectWith(checkQueue: () => Promise<{ messageCount: number; consumerCount: number }>) {
  const channel = { checkQueue: vi.fn(checkQueue), close: vi.fn(async () => {}), on: vi.fn() };
  const connection = {
    createChannel: vi.fn(async () => channel),
    close: vi.fn(async () => {}),
  };
  vi.mocked(connectRabbitMq).mockResolvedValue(
    connection as unknown as Awaited<ReturnType<typeof connectRabbitMq>>,
  );
  return { connection, channel };
}

// What amqplib rejects with when the queue does not exist.
const notFound = () =>
  Object.assign(new Error("Channel closed by server: 404 (NOT-FOUND)"), { code: 404 });

describe("GET /health/rabbitmq", () => {
  beforeEach(() => {
    vi.stubEnv("SECRETS_FILE_PATH", "");
    vi.stubEnv("RABBITMQ_USER", "jts");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns ok, logs the reply queue and closes the connection", async () => {
    const { connection, channel } = connectWith(async () => ({
      messageCount: 3,
      consumerCount: 1,
    }));

    const response = await loader();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(channel.checkQueue).toHaveBeenCalledWith("replies.jts");
    expect(logInfo).toHaveBeenCalledWith(
      "ERV reply queue replies.jts exists (3 messages waiting, 1 consumers)",
    );
    expect(connection.close).toHaveBeenCalled();
  });

  it("logs a missing reply queue but stays ok, since the broker works", async () => {
    const { connection, channel } = connectWith(async () => Promise.reject(notFound()));

    const response = await loader();

    // The channel's error event is heard, so it cannot bring the process down.
    expect(channel.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(response.status).toBe(200);
    expect(logError).toHaveBeenCalledWith("ERV reply queue replies.jts does not exist");
    expect(logInfo).not.toHaveBeenCalled();
    expect(connection.close).toHaveBeenCalled();
  });

  it("logs why the reply queue could not be checked", async () => {
    const refused = Object.assign(new Error("ACCESS_REFUSED"), { code: 403 });
    const { connection } = connectWith(async () => Promise.reject(refused));

    const response = await loader();

    expect(response.status).toBe(200);
    expect(logError).toHaveBeenCalledWith(
      "Could not check the ERV reply queue replies.jts",
      refused,
    );
    expect(connection.close).toHaveBeenCalled();
  });

  it("returns 503 without leaking details when the connection fails", async () => {
    vi.mocked(connectRabbitMq).mockRejectedValue(
      new Error("ACCESS_REFUSED - Login was refused using authentication mechanism PLAIN"),
    );

    const response = await loader();

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("ACCESS_REFUSED");
  });

  it("returns 503 when the configuration is missing", async () => {
    vi.mocked(connectRabbitMq).mockImplementation(() => {
      throw new Error('Missing required environment variable "RABBITMQ_HOST"');
    });

    const response = await loader();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "error" });
  });
});
