import { beforeEach, describe, expect, it, vi } from "vitest";

import { connectRabbitMq } from "~/lib/rabbitmq";

import { loader } from "./rabbitmq";

vi.mock("~/lib/rabbitmq", () => ({ connectRabbitMq: vi.fn() }));

describe("GET /health/rabbitmq", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok and closes the connection when the broker accepts the login", async () => {
    const connection = { close: vi.fn(async () => {}) };
    vi.mocked(connectRabbitMq).mockResolvedValue(
      connection as unknown as Awaited<ReturnType<typeof connectRabbitMq>>,
    );

    const response = await loader();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(connection.close).toHaveBeenCalled();
  });

  it("returns 503 without leaking details when the connection fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(connectRabbitMq).mockRejectedValue(
      new Error("ACCESS_REFUSED - Login was refused using authentication mechanism PLAIN"),
    );

    const response = await loader();

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("ACCESS_REFUSED");
  });

  it("returns 503 when the configuration is missing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(connectRabbitMq).mockImplementation(() => {
      throw new Error('Missing required environment variable "RABBITMQ_HOST"');
    });

    const response = await loader();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "error" });
  });
});
