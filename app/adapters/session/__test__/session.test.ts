// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSessionUser, requireAdmin, requireRole } from "../session";

const { getSession, findUser } = vi.hoisted(() => ({
  getSession: vi.fn(),
  findUser: vi.fn(),
}));

vi.mock("~/lib/auth.server", () => ({ getAuth: () => ({ api: { getSession } }) }));
vi.mock("~/database/database", () => ({
  getDb: () => ({
    selectFrom: () => ({
      select: () => ({ where: () => ({ executeTakeFirst: findUser }) }),
    }),
  }),
}));

const user = {
  id: "user-1",
  name: "Test user",
  email: "test@example.com",
  roles: ["klaeger"],
};
const request = new Request("http://localhost/home");

describe("session access checks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSession.mockResolvedValue({ user: { id: user.id } });
    findUser.mockResolvedValue(user);
  });

  it("redirects unauthenticated users to login", async () => {
    getSession.mockResolvedValue(null);
    await expect(requireRole(request, "richter")).rejects.toMatchObject({
      status: 302,
      headers: expect.any(Headers),
    });
    expect(findUser).not.toHaveBeenCalled();
  });

  it("does not authorize a deleted user even if a session was returned", async () => {
    findUser.mockResolvedValue(undefined);
    expect(await getSessionUser(request)).toBeNull();
  });

  it("uses the database role rather than stale session data", async () => {
    getSession.mockResolvedValue({ user: { ...user, roles: ["admin"] } });
    await expect(requireRole(request, "richter")).rejects.toMatchObject({ status: 403 });
    await expect(requireAdmin(request)).rejects.toMatchObject({ status: 403 });
    expect(await requireRole(request, "klaeger")).toEqual(user);
  });

  it("permits administrators independently of their scheduling role", async () => {
    findUser.mockResolvedValue({ ...user, roles: ["admin"] });
    expect(await requireAdmin(request)).toMatchObject({ roles: ["admin"] });
    for (const role of ["richter", "klaeger", "beklagter"] as const) {
      expect(await requireRole(request, role)).toMatchObject({ roles: ["admin"] });
    }
  });

  it("authorizes every assigned role but not unassigned roles", async () => {
    findUser.mockResolvedValue({ ...user, roles: ["richter", "beklagter"] });
    expect(await requireRole(request, "richter")).toBeDefined();
    expect(await requireRole(request, "beklagter")).toBeDefined();
    await expect(requireRole(request, "klaeger")).rejects.toMatchObject({ status: 403 });
    await expect(requireAdmin(request)).rejects.toMatchObject({ status: 403 });
  });
});
