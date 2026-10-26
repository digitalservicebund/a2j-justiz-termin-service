// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin } from "~/adapters/session/session";
import {
  AllowedDomainError,
  deleteAllowedDomain,
  insertAllowedDomain,
  listAllowedDomains,
} from "~/adapters/users/allowed-domains.server";

import { action, loader } from "../admin-domains";

vi.mock("~/adapters/session/session", () => ({ requireAdmin: vi.fn() }));
vi.mock("~/adapters/users/allowed-domains.server", () => ({
  AllowedDomainError: class AllowedDomainError extends Error {},
  deleteAllowedDomain: vi.fn(),
  insertAllowedDomain: vi.fn(),
  listAllowedDomains: vi.fn(),
}));
vi.mock("~/database/database", () => ({ getDb: () => ({ name: "db" }) }));

function request(values: Record<string, string>) {
  return new Request("http://localhost/admin/domains", {
    method: "POST",
    headers: { Origin: "http://localhost" },
    body: new URLSearchParams(values),
  });
}

describe("admin domains route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("requires administrator permission on both entry points", async () => {
    const forbidden = new Response("Forbidden", { status: 403 });
    vi.mocked(requireAdmin).mockRejectedValue(forbidden);
    const get = new Request("http://localhost/admin/domains");
    await expect(loader({ request: get })).rejects.toBe(forbidden);
    await expect(
      action({ request: request({ intent: "create", domain: "example.com" }) }),
    ).rejects.toBe(forbidden);
    expect(insertAllowedDomain).not.toHaveBeenCalled();
    expect(deleteAllowedDomain).not.toHaveBeenCalled();
  });

  it("lists the allowed domains", async () => {
    const user = { id: "admin-1", name: "Admin A", email: "admin.a@example.com", roles: ["admin"] };
    vi.mocked(requireAdmin).mockResolvedValue(user as never);
    vi.mocked(listAllowedDomains).mockResolvedValue([{ domain: "example.com" }]);
    expect(await loader({ request: new Request("http://localhost/admin/domains") })).toEqual({
      user,
      domains: [{ domain: "example.com" }],
    });
  });

  describe("action", () => {
    beforeEach(() => vi.mocked(requireAdmin).mockResolvedValue({} as never));

    it("adds a normalized domain", async () => {
      const result = await action({
        request: request({ intent: "create", domain: " Example.COM " }),
      });
      expect(insertAllowedDomain).toHaveBeenCalledWith({ name: "db" }, "example.com");
      expect(result).toMatchObject({ data: { success: expect.any(String) } });
    });

    it("removes a domain", async () => {
      const result = await action({
        request: request({ intent: "delete", domain: "example.com" }),
      });
      expect(deleteAllowedDomain).toHaveBeenCalledWith({ name: "db" }, "example.com");
      expect(result).toMatchObject({ data: { success: expect.any(String) } });
    });

    it.each<Record<string, string>>([
      { intent: "create", domain: "not a domain" },
      { intent: "create", domain: "person@example.com" },
      { intent: "create" },
      { intent: "update", domain: "example.com" },
      { domain: "example.com" },
    ])("rejects invalid input %j", async (values) => {
      expect(await action({ request: request(values) })).toMatchObject({
        init: { status: 400 },
        data: { error: expect.any(String) },
      });
      expect(insertAllowedDomain).not.toHaveBeenCalled();
      expect(deleteAllowedDomain).not.toHaveBeenCalled();
    });

    it("reports a duplicate or unknown domain", async () => {
      vi.mocked(insertAllowedDomain).mockRejectedValue(new AllowedDomainError("Schon vorhanden."));
      expect(
        await action({ request: request({ intent: "create", domain: "example.com" }) }),
      ).toMatchObject({ init: { status: 400 }, data: { error: "Schon vorhanden." } });
      vi.mocked(deleteAllowedDomain).mockRejectedValue(new AllowedDomainError("Nicht gefunden."));
      expect(
        await action({ request: request({ intent: "delete", domain: "example.com" }) }),
      ).toMatchObject({ init: { status: 400 }, data: { error: "Nicht gefunden." } });
    });

    it("does not hide unexpected failures", async () => {
      vi.mocked(insertAllowedDomain).mockRejectedValue(new Error("db down"));
      await expect(
        action({ request: request({ intent: "create", domain: "example.com" }) }),
      ).rejects.toThrow("db down");
    });
  });
});
