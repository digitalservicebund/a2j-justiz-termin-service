import { createTransport } from "nodemailer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSmtpTransport } from "../smtp";

vi.mock("nodemailer", () => ({ createTransport: vi.fn() }));

describe("createSmtpTransport", () => {
  beforeEach(() => {
    vi.stubEnv("SECRETS_FILE_PATH", "");
    vi.stubEnv("SMTP_HOST", "localhost");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USER", "user");
    vi.stubEnv("SMTP_PASSWORD", "pass");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("requires STARTTLS unless SMTP_REQUIRE_TLS is false", () => {
    createSmtpTransport();
    expect(createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ host: "localhost", port: 587, requireTLS: true }),
    );

    vi.stubEnv("SMTP_REQUIRE_TLS", "false");
    createSmtpTransport();
    expect(createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ requireTLS: false }),
    );
  });

  it("throws when the host is missing", () => {
    vi.stubEnv("SMTP_HOST", "");
    expect(() => createSmtpTransport()).toThrow('"SMTP_HOST"');
  });
});
