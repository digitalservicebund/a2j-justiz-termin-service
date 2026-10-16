import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getAuthSecret } from "../auth-secret";
import { requireSecret } from "../secrets";

vi.mock("../secrets", () => ({ requireSecret: vi.fn() }));

describe("auth signing secret", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("SECRETS_FILE_PATH", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetAllMocks();
  });

  it("requires a configured secret even in development", () => {
    vi.mocked(requireSecret).mockImplementation(() => {
      throw new Error("BETTER_AUTH_SECRET is required");
    });
    expect(getAuthSecret).toThrow("BETTER_AUTH_SECRET is required");
    expect(requireSecret).toHaveBeenCalledWith("better-auth", "BETTER_AUTH_SECRET");
  });

  it("honors an explicitly injected local secret", () => {
    vi.stubEnv("BETTER_AUTH_SECRET", "injected");
    vi.mocked(requireSecret).mockReturnValue("injected");
    expect(getAuthSecret()).toBe("injected");
    expect(requireSecret).toHaveBeenCalledWith("better-auth", "BETTER_AUTH_SECRET");
  });

  it("never uses a dummy secret when mounted secrets are configured", () => {
    vi.stubEnv("SECRETS_FILE_PATH", "/etc/secrets");
    vi.mocked(requireSecret).mockImplementation(() => {
      throw new Error("Mounted secret missing");
    });
    expect(getAuthSecret).toThrow("Mounted secret missing");
    expect(requireSecret).toHaveBeenCalledWith("better-auth", "BETTER_AUTH_SECRET");
  });

  it("requires a provisioned secret in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(requireSecret).mockImplementation(() => {
      throw new Error("BETTER_AUTH_SECRET is required");
    });
    expect(getAuthSecret).toThrow("BETTER_AUTH_SECRET is required");
  });
});
