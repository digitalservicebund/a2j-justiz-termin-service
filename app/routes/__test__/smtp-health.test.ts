import { beforeEach, describe, expect, it, vi } from "vitest";

import { createSmtpTransport } from "~/lib/smtp";

import { loader } from "../smtp-health";

vi.mock("~/lib/smtp", () => ({ createSmtpTransport: vi.fn() }));

function transportWith(verify: () => Promise<true>) {
  const transport = { verify: vi.fn(verify), close: vi.fn() };
  vi.mocked(createSmtpTransport).mockReturnValue(
    transport as unknown as ReturnType<typeof createSmtpTransport>,
  );
  return transport;
}

describe("GET /health/smtp", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns ok when the SMTP login succeeds", async () => {
    const transport = transportWith(async () => true);

    const response = await loader();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok" });
    expect(transport.close).toHaveBeenCalled();
  });

  it("returns 503 without leaking details when verification fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const transport = transportWith(async () => {
      throw new Error("535 Authentication failed for user secret-user");
    });

    const response = await loader();

    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("secret-user");
    expect(transport.close).toHaveBeenCalled();
  });

  it("returns 503 when the configuration is missing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(createSmtpTransport).mockImplementation(() => {
      throw new Error('Missing required environment variable "SMTP_HOST"');
    });

    const response = await loader();

    expect(response.status).toBe(503);
  });
});
