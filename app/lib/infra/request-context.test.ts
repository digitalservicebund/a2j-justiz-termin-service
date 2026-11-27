// @vitest-environment node
import { createServer, type Server } from "node:http";

import express, { type RequestHandler } from "express";
import { afterEach, describe, expect, it } from "vitest";

import { createLogger } from "./logging.ts";
import { requestContext } from "./request-context.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const ok: RequestHandler = (_req, res) => {
  res.send("OK");
};

describe("requestContext", () => {
  let server: Server | undefined;

  afterEach(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    server = undefined;
  });

  async function serve(handler: RequestHandler): Promise<string> {
    const app = express();
    app.use(requestContext, handler);
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP address");
    return `http://127.0.0.1:${address.port}`;
  }

  it("gives a request without an id a new one and sends it back", async () => {
    const response = await fetch(await serve(ok));

    expect(response.headers.get("X-Request-Id")).toMatch(UUID);
  });

  it("keeps a valid id from the ingress", async () => {
    const response = await fetch(await serve(ok), { headers: { "X-Request-Id": "ingress-1" } });

    expect(response.headers.get("X-Request-Id")).toBe("ingress-1");
  });

  it("replaces an id that could forge a log line", async () => {
    const response = await fetch(await serve(ok), {
      headers: { "X-Request-Id": 'x", "level": "fatal' },
    });

    expect(response.headers.get("X-Request-Id")).toMatch(UUID);
  });

  it("gives the lines logged while handling the request its id, also after an await", async () => {
    const lines: string[] = [];
    const logger = createLogger("info", {
      write: (line: string) => {
        lines.push(line);
      },
    });
    const base = await serve(async (_req, res) => {
      await new Promise((resolve) => setTimeout(resolve, 1));
      logger.info("inside the handler");
      res.send("OK");
    });

    const response = await fetch(base);

    expect(JSON.parse(lines[0]!)).toMatchObject({
      requestId: response.headers.get("X-Request-Id"),
      msg: "inside the handler",
    });
  });
});
