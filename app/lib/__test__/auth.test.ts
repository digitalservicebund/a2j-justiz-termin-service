// @vitest-environment node
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAuth } from "../auth.server";
import { requireEnv } from "../env";

const { findUser, where, sendMail, close } = vi.hoisted(() => ({
  findUser: vi.fn(),
  where: vi.fn(),
  sendMail: vi.fn(),
  close: vi.fn(),
}));

vi.mock("better-auth", () => ({ betterAuth: vi.fn((options) => ({ options })) }));
vi.mock("better-auth/plugins", () => ({
  magicLink: vi.fn(() => ({ id: "magic-link" })),
}));
vi.mock("~/database/database", () => ({
  getDb: () => ({
    selectFrom: () => ({
      select: () => ({
        where: (...args: unknown[]) => {
          where(...args);
          return { executeTakeFirst: findUser };
        },
      }),
    }),
  }),
}));
vi.mock("~/lib/smtp", () => ({
  createSmtpTransport: () => ({ sendMail, close }),
}));
vi.mock("~/lib/env", () => ({ requireEnv: vi.fn(() => "http://localhost:3000") }));
vi.mock("~/lib/secrets", () => ({ requireSecret: () => "sender@example.com" }));
vi.mock("~/lib/logging", () => ({ logError: vi.fn() }));

getAuth();
const options = vi.mocked(betterAuth).mock.calls[0]![0]!;
const plugin = vi.mocked(magicLink).mock.calls[0]![0];
const environmentReads = vi.mocked(requireEnv).mock.calls.map(([name]) => name);

describe("magic-link configuration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses BASE_URL as the canonical auth origin", () => {
    expect(environmentReads).toEqual(["BASE_URL"]);
    expect(options.baseURL).toBe("http://localhost:3000");
  });

  it("disables public sign-up and stores only hashed, short-lived tokens", () => {
    expect(plugin).toMatchObject({ disableSignUp: true, storeToken: "hashed", expiresIn: 300 });
    expect(options.user?.additionalFields?.roles).toMatchObject({ type: "string[]", input: false });
    expect(options.session?.cookieCache?.enabled).toBe(false);
    expect(options.rateLimit).toEqual({ enabled: false });
  });

  it("never sends email to an address outside the user list", async () => {
    findUser.mockResolvedValue(undefined);
    await plugin.sendMagicLink({
      email: "unknown@example.com",
      url: "http://localhost/link",
      token: "test",
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("normalizes the allowlist lookup and emails the maintained address", async () => {
    findUser.mockResolvedValue({ email: "known@example.com" });
    await plugin.sendMagicLink({
      email: "Known@Example.com",
      url: "http://localhost/link",
      token: "test",
    });
    expect(where).toHaveBeenCalledWith("email", "=", "known@example.com");
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "known@example.com",
        text: expect.stringContaining("http://localhost/link"),
      }),
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("surfaces mail delivery failures and closes the transport", async () => {
    findUser.mockResolvedValue({ email: "known@example.com" });
    sendMail.mockRejectedValue(new Error("SMTP unavailable"));
    await expect(
      plugin.sendMagicLink({
        email: "known@example.com",
        url: "http://localhost/link",
        token: "test",
      }),
    ).rejects.toThrow("SMTP unavailable");
    expect(close).toHaveBeenCalledOnce();
  });
});
