// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callAction, callLoader } from "~tests/route";

import { requireRole } from "~/adapters/session/session";
import { deleteSitzungstag, listSitzungstage } from "~/adapters/users/sitzungstage.server";
import type { AuthUser } from "~/core/domain/user";

import { action, loader } from "./settings";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/users/sitzungstage.server", () => ({
  listSitzungstage: vi.fn(),
  deleteSitzungstag: vi.fn(),
}));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const judge: AuthUser = {
  id: "j1",
  name: "Judge A",
  email: "judge.a@example.com",
  roles: ["richter"],
};

const get = () => ({ request: new Request("http://localhost/einstellungen") });
const post = (body: Record<string, string>) => ({
  request: new Request("http://localhost/einstellungen", {
    method: "POST",
    body: new URLSearchParams(body),
  }),
});

describe("settings route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(listSitzungstage).mockResolvedValue([]);
    vi.mocked(deleteSitzungstag).mockResolvedValue(true);
  });

  it("requires the richter role to load and to submit", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Response("Forbidden", { status: 403 }));

    expect(await callLoader(loader, get())).toMatchObject({ thrown: true, status: 403 });
    expect(await callAction(action, post({ intent: "delete:s1" }))).toMatchObject({
      thrown: true,
      status: 403,
    });
    expect(requireRole).toHaveBeenCalledWith(expect.any(Request), "richter");
    expect(deleteSitzungstag).not.toHaveBeenCalled();
  });

  it("lists the judge's Sitzungstage with weekday and times", async () => {
    vi.mocked(listSitzungstage).mockResolvedValue([
      { id: "s1", weekday: 2, start: 10 * 60, end: 17 * 60 },
      { id: "s2", weekday: 4, start: 9 * 60, end: 16 * 60 },
    ]);

    const outcome = await callLoader(loader, get());

    expect(outcome).toMatchObject({
      thrown: false,
      data: {
        user: judge,
        rows: [
          { id: "s1", weekday: "Dienstag", times: "10:00 bis 17:00" },
          { id: "s2", weekday: "Donnerstag", times: "09:00 bis 16:00" },
        ],
      },
    });
    expect(listSitzungstage).toHaveBeenCalledWith({ db: true }, "j1");
  });

  it("deletes a Sitzungstag of the judge and shows the list again", async () => {
    const outcome = await callAction(action, post({ intent: "delete:s1" }));

    expect(outcome).toMatchObject({ status: 302, location: "/einstellungen" });
    expect(deleteSitzungstag).toHaveBeenCalledWith({ db: true }, "j1", "s1");
  });

  it("answers 404 when the judge has no Sitzungstag with that id", async () => {
    vi.mocked(deleteSitzungstag).mockResolvedValue(false);

    expect(await callAction(action, post({ intent: "delete:other" }))).toMatchObject({
      thrown: true,
      status: 404,
    });
  });

  it.each<Record<string, string>>([
    {},
    { intent: "delete:" },
    { intent: "edit:s1" },
    { intent: "s1" },
  ])("answers 400 to a submit no button can send: %j", async (body) => {
    expect(await callAction(action, post(body))).toMatchObject({ thrown: true, status: 400 });
    expect(deleteSitzungstag).not.toHaveBeenCalled();
  });
});
