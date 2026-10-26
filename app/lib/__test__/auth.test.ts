// @vitest-environment node
import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAuth } from "../auth.server";
import { requireEnv } from "../env";

const { canSignIn, userExists, isEmailDomainAllowed, sendMail, close } = vi.hoisted(() => ({
  canSignIn: vi.fn(),
  userExists: vi.fn(),
  isEmailDomainAllowed: vi.fn(),
  sendMail: vi.fn(),
  close: vi.fn(),
}));

vi.mock("better-auth", () => ({ betterAuth: vi.fn((options) => ({ options })) }));
vi.mock("better-auth/plugins", () => ({
  magicLink: vi.fn(() => ({ id: "magic-link" })),
}));
vi.mock("~/database/database", () => ({ getDb: () => ({ name: "db" }) }));
vi.mock("~/adapters/users/users.server", () => ({ canSignIn, userExists }));
vi.mock("~/adapters/users/allowed-domains.server", () => ({ isEmailDomainAllowed }));
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

  it("stores only hashed, short-lived tokens", () => {
    expect(plugin).toMatchObject({ storeToken: "hashed", expiresIn: 300 });
    expect(options.user?.additionalFields?.roles).toMatchObject({ type: "string[]", input: false });
    expect(options.session?.cookieCache?.enabled).toBe(false);
    expect(options.rateLimit).toEqual({ enabled: false });
  });

  it("never sends email to an address outside the user list and allowed domains", async () => {
    canSignIn.mockResolvedValue(false);
    await plugin.sendMagicLink({
      email: "unknown@example.com",
      url: "http://localhost/link",
      token: "test",
    });
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("normalizes the address and emails it when sign-in is allowed", async () => {
    canSignIn.mockResolvedValue(true);
    userExists.mockResolvedValue(true);
    await plugin.sendMagicLink({
      email: "Known@Example.com",
      url: "http://localhost/link",
      token: "test",
    });
    expect(canSignIn).toHaveBeenCalledWith({ name: "db" }, "Known@Example.com");
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "known@example.com",
        subject: "Anmelden beim Verhandlungstermin-Finder",
        text: expect.stringContaining("http://localhost/link"),
        html: expect.stringContaining("http://localhost/link"),
        attachments: [expect.objectContaining({ cid: expect.any(String) })],
      }),
    );
    expect(close).toHaveBeenCalledOnce();
  });

  it("sends the verification mail to an address without an account", async () => {
    canSignIn.mockResolvedValue(true);
    userExists.mockResolvedValue(false);
    await plugin.sendMagicLink({
      email: "new@example.com",
      url: "http://localhost/link",
      token: "test",
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Verifizieren Sie Ihre E-Mail-Adresse" }),
    );
  });

  it("surfaces mail delivery failures and closes the transport", async () => {
    canSignIn.mockResolvedValue(true);
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

describe("self sign-up", () => {
  const before = options.databaseHooks!.user!.create!.before!;

  beforeEach(() => vi.clearAllMocks());

  it("creates an account with the self sign-up role for an allowed domain", async () => {
    isEmailDomainAllowed.mockResolvedValue(true);
    const result = await before({ email: " Person.A@Example.com ", name: "" } as never, null);
    expect(isEmailDomainAllowed).toHaveBeenCalledWith({ name: "db" }, "person.a@example.com");
    expect(result).toMatchObject({
      data: { email: "person.a@example.com", name: "person.a", roles: "{richter}" },
    });
  });

  it("keeps a name that was provided", async () => {
    isEmailDomainAllowed.mockResolvedValue(true);
    const result = await before({ email: "person@example.com", name: "Person A" } as never, null);
    expect(result).toMatchObject({ data: { name: "Person A" } });
  });

  it("refuses to create an account for any other domain", async () => {
    isEmailDomainAllowed.mockResolvedValue(false);
    expect(await before({ email: "person@example.org", name: "" } as never, null)).toBe(false);
  });
});
