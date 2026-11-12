// @vitest-environment node
import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { limitRequestBody, MAX_BODY_BYTES } from "../body-limit";

function request(headers: Record<string, string>) {
  return { headers } as Request;
}

function response() {
  const end = vi.fn();
  const status = vi.fn(() => ({ end }));
  return { status, end } as unknown as Response & { status: typeof status; end: typeof end };
}

describe("request body limit", () => {
  it("passes requests without a body", () => {
    const req = request({});
    const res = response();
    const next = vi.fn();

    limitRequestBody(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each(["0", "512", String(MAX_BODY_BYTES)])("passes a body of %s bytes", (length) => {
    const req = request({ "content-length": length });
    const res = response();
    const next = vi.fn();

    limitRequestBody(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("rejects a body over the limit with 413", () => {
    const req = request({ "content-length": String(MAX_BODY_BYTES + 1) });
    const res = response();
    const next = vi.fn();

    limitRequestBody(req, res, next);

    expect(res.status).toHaveBeenCalledWith(413);
    expect(res.end).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects a chunked body without a length with 411", () => {
    const req = request({ "transfer-encoding": "chunked" });
    const res = response();
    const next = vi.fn();

    limitRequestBody(req, res, next);

    expect(res.status).toHaveBeenCalledWith(411);
    expect(res.end).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
  });

  it.each(["", "abc", "-1", "1.5", "1e3", " 12", "99999999999999999999"])(
    "rejects the invalid length %j with 400",
    (length) => {
      const req = request({ "content-length": length });
      const res = response();
      const next = vi.fn();

      limitRequestBody(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.end).toHaveBeenCalledOnce();
      expect(next).not.toHaveBeenCalled();
    },
  );
});
