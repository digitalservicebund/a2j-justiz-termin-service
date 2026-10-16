// @vitest-environment node
import { createServer } from "node:http";

import morgan from "morgan";
import { describe, expect, it } from "vitest";

import { accessLogFormat } from "../access-log";

describe("access logging", () => {
  it.each([
    "/api/auth/magic-link/verify?token=secret-token&callbackURL=%2Fhome",
    "/?callbackURL=%2Fapi%2Fauth%2Fmagic-link%2Fverify%3Ftoken%3Dsecret-token",
    "/home",
  ])("logs the path and response metadata without query parameters: %s", async (path) => {
    const lines: string[] = [];
    const logger = morgan(accessLogFormat, {
      stream: {
        write: (line) => {
          lines.push(line);
        },
      },
    });
    const server = createServer((request, response) => {
      logger(request, response, () => {
        response.statusCode = 200;
        response.setHeader("Content-Length", "2");
        response.end("OK");
      });
    });
    try {
      await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("Expected a TCP address");
      await fetch(`http://127.0.0.1:${address.port}${path}`);
      await expect.poll(() => lines.length).toBe(1);
      expect(lines[0]).toMatch(new RegExp(`^GET ${path.split("?")[0]} 200 2 - [\\d.]+ ms\\n$`));
      expect(lines[0]).not.toContain("secret-token");
      expect(lines[0]).not.toContain("?");
      expect(lines[0]).not.toContain("callbackURL");
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
