// @vitest-environment node
import { Writable } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createLogger, log, logAudit, serializeError, withLogContext } from "./logging.ts";

// A logger that writes into an array, one parsed object per line.
function capture(level = "info") {
  const lines: Array<Record<string, unknown>> = [];
  const destination = new Writable({
    write(chunk: Buffer, _encoding, done) {
      lines.push(JSON.parse(chunk.toString()) as Record<string, unknown>);
      done();
    },
  });
  return { logger: createLogger(level, destination), lines };
}

describe("createLogger", () => {
  it("writes one JSON object per line with a level name, an ISO time and the message", () => {
    const { logger, lines } = capture();

    logger.info({ appointmentId: "a1" }, "appointment saved");

    expect(lines).toEqual([
      { level: "info", time: expect.any(String), appointmentId: "a1", msg: "appointment saved" },
    ]);
    expect(new Date(lines[0]!.time as string).toISOString()).toBe(lines[0]!.time);
  });

  it("leaves out lines below its level", () => {
    const { logger, lines } = capture("warn");

    logger.info("not shown");
    logger.warn("shown");

    expect(lines.map(({ msg }) => msg)).toEqual(["shown"]);
  });

  it("adds the request id of the current log context", () => {
    const { logger, lines } = capture();

    withLogContext({ requestId: "r1" }, () => logger.info("inside"));
    logger.info("outside");

    expect(lines[0]).toMatchObject({ requestId: "r1", msg: "inside" });
    expect(lines[1]).not.toHaveProperty("requestId");
  });

  it("keeps the request id of the context across awaits", async () => {
    const { logger, lines } = capture();

    await withLogContext({ requestId: "r2" }, async () => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      logger.info("later");
    });

    expect(lines[0]).toMatchObject({ requestId: "r2" });
  });

  it("redacts sensitive keys, also one level down", () => {
    const { logger, lines } = capture();

    logger.info(
      {
        email: "person.a@example.com",
        token: "secret-token",
        participant: { safeId: "DE.Example.1", id: "p1" },
      },
      "careless",
    );

    expect(lines[0]).toMatchObject({
      email: "[redacted]",
      token: "[redacted]",
      participant: { safeId: "[redacted]", id: "p1" },
    });
    expect(JSON.stringify(lines)).not.toMatch(/example\.com|secret-token|DE\.Example/);
  });

  it("logs errors under err with type, message, code, stack and cause", () => {
    const { logger, lines } = capture();
    const cause = Object.assign(new Error("connection refused"), { code: "ECONNREFUSED" });

    logger.error({ err: new Error("send failed", { cause }) }, "mail not sent");

    expect(lines[0]).toMatchObject({
      level: "error",
      msg: "mail not sent",
      err: {
        type: "Error",
        message: "send failed",
        stack: expect.stringContaining("send failed"),
        cause: { type: "Error", message: "connection refused", code: "ECONNREFUSED" },
      },
    });
  });
});

describe("serializeError", () => {
  it("removes e-mail addresses from the message and the stack", () => {
    const error = new Error("550 5.1.1 <person.a@example.com>: Recipient address rejected");

    const serialized = JSON.stringify(serializeError(error));

    expect(serialized).not.toContain("person.a@example.com");
    expect(serialized).toContain("<[email]>: Recipient address rejected");
  });

  it("keeps package versions in stack paths, which look like addresses", () => {
    const error = new Error("boom");
    error.stack =
      "Error: boom\n    at fix (/app/node_modules/.pnpm/pino@10.4.0/node_modules/pino/lib/transport.js:1:1)";

    expect(serializeError(error)).toMatchObject({
      stack: expect.stringContaining("pino@10.4.0/node_modules/pino/lib/transport.js"),
    });
  });

  it("leaves out other properties, which can hold recipients or row details", () => {
    const error = Object.assign(new Error("rejected"), {
      rejected: ["person.a@example.com"],
      detail: "Key (email)=(person.a@example.com) already exists.",
    });

    expect(JSON.stringify(serializeError(error))).not.toContain("person.a@example.com");
  });

  it("turns values that are not errors into scrubbed text", () => {
    expect(serializeError("failed for person.a@example.com")).toBe("failed for [email]");
  });

  it("stops following causes that go on and on", () => {
    let error = new Error("innermost");
    for (let index = 0; index < 10; index += 1)
      error = new Error(`level ${index}`, { cause: error });

    let depth = 0;
    let current = serializeError(error) as { cause?: unknown };
    while (current.cause) {
      current = current.cause as { cause?: unknown };
      depth += 1;
    }

    expect(depth).toBe(5);
  });
});

describe("logAudit", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs the event at info, marked as audit, with the actor and the ids", () => {
    const info = vi.spyOn(log, "info").mockImplementation(() => {});

    logAudit("appointment.confirmed", { actorId: "u1", appointmentId: "a1" });

    expect(info).toHaveBeenCalledWith(
      { actorId: "u1", appointmentId: "a1", audit: true, event: "appointment.confirmed" },
      "appointment.confirmed",
    );
  });
});
