import { connect } from "amqplib";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { connectRabbitMq } from "./rabbitmq";

vi.mock("amqplib", () => ({ connect: vi.fn() }));

describe("connectRabbitMq", () => {
  beforeEach(() => {
    vi.stubEnv("SECRETS_FILE_PATH", "");
    vi.stubEnv("RABBITMQ_HOST", "localhost");
    vi.stubEnv("RABBITMQ_PORT", "5671");
    vi.stubEnv("RABBITMQ_VHOST", "/");
    vi.stubEnv("RABBITMQ_USER", "user");
    vi.stubEnv("RABBITMQ_PASSWORD", "pass");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("connects with TLS unless RABBITMQ_TLS is false", async () => {
    await connectRabbitMq();
    expect(connect).toHaveBeenLastCalledWith(
      {
        protocol: "amqps",
        hostname: "localhost",
        port: 5671,
        vhost: "/",
        username: "user",
        password: "pass",
      },
      { timeout: 5000 },
    );

    vi.stubEnv("RABBITMQ_TLS", "false");
    await connectRabbitMq();
    expect(connect).toHaveBeenLastCalledWith(
      expect.objectContaining({ protocol: "amqp" }),
      expect.anything(),
    );
  });

  it("throws when the host is missing", () => {
    vi.stubEnv("RABBITMQ_HOST", "");
    expect(() => connectRabbitMq()).toThrow('"RABBITMQ_HOST"');
  });

  it("throws when the password is missing", () => {
    vi.stubEnv("RABBITMQ_PASSWORD", "");
    expect(() => connectRabbitMq()).toThrow('"RABBITMQ_PASSWORD"');
  });
});
