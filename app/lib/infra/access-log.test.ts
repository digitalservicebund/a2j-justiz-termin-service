// @vitest-environment node
import { createServer, type Server } from "node:http";

import express, { type RequestHandler } from "express";
import type { RouteObject } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import routes from "../../routes.ts";
import { BASE_PATH } from "../web/base-path.ts";
import { accessLog, routePatternMatcher } from "./access-log.ts";
import { createLogger } from "./logging.ts";
import { requestContext } from "./request-context.ts";

describe("routePatternMatcher", () => {
  const routeOf = routePatternMatcher([{ children: routes as RouteObject[] }]);

  it.each([
    ["/", `${BASE_PATH}/`],
    ["/?callbackURL=%2Fapi%2Fauth%2Fmagic-link%2Fverify%3Ftoken%3Dsecret", `${BASE_PATH}/`],
    ["/overview/a1#details", `${BASE_PATH}/overview/:appointmentId`],
    ["/umfrage/secret-token", `${BASE_PATH}/umfrage/:token`],
    ["/umfrage/secret-token/zeitfenster?slot=1", `${BASE_PATH}/umfrage/:token/zeitfenster`],
    ["/api/calendars/secret-token/feed.ics", `${BASE_PATH}/api/calendars/:token/feed.ics`],
    ["/api/auth/magic-link/verify?token=secret", `${BASE_PATH}/api/auth/*`],
  ])("names %s by its route %s", (path, expected) => {
    expect(routeOf(`${BASE_PATH}${path}`)).toBe(expected);
  });

  it("names no route for a path outside the app or without a route", () => {
    expect(routeOf("/elsewhere")).toBeUndefined();
    expect(routeOf(`${BASE_PATH}/no/such/page`)).toBeUndefined();
  });
});

// The server build's manifest for a few of the routes.
const manifest = {
  root: { id: "root", path: "" },
  welcome: { id: "welcome", parentId: "root", index: true },
  survey: { id: "survey", parentId: "root", path: "umfrage/:token" },
  health: { id: "health", parentId: "root", path: "health" },
  smtp: { id: "smtp", parentId: "root", path: "health/smtp" },
};

const answer =
  (status: number): RequestHandler =>
  (_req, res) => {
    res.status(status).send("OK");
  };

describe("accessLog", () => {
  let server: Server | undefined;

  afterEach(async () => {
    await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
    server = undefined;
  });

  async function serve(handler: RequestHandler) {
    const lines: Array<Record<string, unknown>> = [];
    const logger = createLogger("info", {
      write: (line: string) => {
        lines.push(JSON.parse(line) as Record<string, unknown>);
      },
    });
    const app = express();
    app.use(requestContext, accessLog(manifest, logger));
    app.use(handler);
    server = createServer(app);
    await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected a TCP address");
    return { base: `http://127.0.0.1:${address.port}${BASE_PATH}`, lines };
  }

  it("logs method, route, status, time and size, never the path or query", async () => {
    const { base, lines } = await serve(answer(200));

    const response = await fetch(`${base}/umfrage/secret-token?x=secret-query`);

    await expect.poll(() => lines.length).toBe(1);
    expect(lines[0]).toEqual({
      level: "info",
      time: expect.any(String),
      requestId: response.headers.get("X-Request-Id"),
      method: "GET",
      route: `${BASE_PATH}/umfrage/:token`,
      status: 200,
      responseTimeMs: expect.any(Number),
      contentLength: 2,
      msg: "request completed",
    });
    expect(JSON.stringify(lines)).not.toContain("secret");
  });

  it("logs no route for a path without one", async () => {
    const { base, lines } = await serve(answer(404));

    await fetch(`${base}/secret-token`);

    await expect.poll(() => lines.length).toBe(1);
    expect(lines[0]).toMatchObject({ route: null, status: 404, level: "info" });
    expect(JSON.stringify(lines)).not.toContain("secret");
  });

  it("leaves out successful health checks", async () => {
    const { base, lines } = await serve(answer(200));

    await fetch(`${base}/health`);
    await fetch(`${base}/health/smtp`);
    await fetch(`${base}/`);

    await expect.poll(() => lines.length).toBe(1);
    expect(lines[0]).toMatchObject({ route: `${BASE_PATH}/` });
  });

  it("logs a failed health check as an error", async () => {
    const { base, lines } = await serve(answer(503));

    await fetch(`${base}/health/smtp`);

    await expect.poll(() => lines.length).toBe(1);
    expect(lines[0]).toMatchObject({
      level: "error",
      route: `${BASE_PATH}/health/smtp`,
      status: 503,
      msg: "request failed",
    });
  });
});
