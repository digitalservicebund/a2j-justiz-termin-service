// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireAdmin, requireRole } from "~/adapters/session/session";
import { hasRole, NewUserSchema, UserRoleSchema } from "~/core/domain/user";

import { action as adminAction, loader as adminLoader } from "../admin-users";
import { action as defendantAction } from "../beklagter";
import { action as plaintiffAction } from "../klaeger";
import { action as judgeAction } from "../richter";

vi.mock("~/adapters/session/session", () => ({
  requireAdmin: vi.fn(),
  requireRole: vi.fn(),
}));

describe("protected route entry points", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["richter", judgeAction],
    ["klaeger", plaintiffAction],
    ["beklagter", defendantAction],
  ] as const)("requires %s before processing a scheduling action", async (role, action) => {
    const forbidden = new Response("Forbidden", { status: 403 });
    vi.mocked(requireRole).mockRejectedValue(forbidden);
    const request = new Request("http://localhost/", { method: "POST" });
    await expect(action({ request })).rejects.toBe(forbidden);
    expect(requireRole).toHaveBeenCalledWith(request, role);
  });

  it("requires administrator permission on both management entry points", async () => {
    const forbidden = new Response("Forbidden", { status: 403 });
    vi.mocked(requireAdmin).mockRejectedValue(forbidden);
    const request = new Request("http://localhost/admin/users");
    await expect(adminLoader({ request })).rejects.toBe(forbidden);
    await expect(adminAction({ request })).rejects.toBe(forbidden);
  });

  it("normalizes provisioned addresses and rejects invalid roles", () => {
    expect(
      NewUserSchema.parse({
        email: " ADMIN@example.org ",
        name: " Admin ",
        roles: ["admin", "richter"],
      }),
    ).toEqual({ email: "admin@example.org", name: "Admin", roles: ["admin", "richter"] });
    expect(
      NewUserSchema.safeParse({
        email: "admin@example.org",
        name: "Admin",
        roles: ["ADMIN"],
      }).success,
    ).toBe(false);
    for (const roles of [[], ["richter", "richter"]]) {
      expect(NewUserSchema.safeParse({ email: "a@example.org", name: "A", roles }).success).toBe(
        false,
      );
    }
  });

  it("accepts every nonempty role combination and grants exactly the expected access", () => {
    const available = UserRoleSchema.options;
    for (let mask = 1; mask < 1 << available.length; mask++) {
      const roles = available.filter((_, index) => mask & (1 << index));
      const user = {
        id: "test-user",
        ...NewUserSchema.parse({ email: "test@example.org", name: "Test", roles }),
      };
      for (const role of available) {
        expect(hasRole(user, role)).toBe(roles.includes("admin") || roles.includes(role));
      }
    }
  });
});
