// @vitest-environment node
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { rewriteLegacyHealthPath } from "../legacy-health";

function rewrite(url: string) {
  const req = { url, originalUrl: url, path: url.split("?", 1)[0] } as Request;
  const next = vi.fn();
  rewriteLegacyHealthPath(req, {} as Response, next);
  expect(next).toHaveBeenCalledOnce();
  // React Router reads originalUrl, Express routing reads url: both must agree.
  expect(req.originalUrl).toBe(req.url);
  return req.url;
}

describe("legacy health URLs", () => {
  it.each(["/health", "/health/", "/health/database", "/health/smtp"])(
    "moves %s under the base path",
    (path) => {
      expect(rewrite(path)).toBe(`/verhandlungstermin-finder${path}`);
    },
  );

  it("keeps the query string", () => {
    expect(rewrite("/health?probe=1")).toBe("/verhandlungstermin-finder/health?probe=1");
  });

  it.each([
    "/verhandlungstermin-finder/health",
    "/health/other",
    "/healthcheck",
    "/overview",
    "/health/database/extra",
  ])("leaves %s alone", (path) => {
    expect(rewrite(path)).toBe(path);
  });
});
