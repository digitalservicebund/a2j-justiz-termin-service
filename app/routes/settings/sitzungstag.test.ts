// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callAction, callLoader } from "~tests/route";

import { requireRole } from "~/adapters/session/session";
import {
  addSitzungstag,
  listSitzungstage,
  updateSitzungstag,
} from "~/adapters/users/sitzungstage.server";
import type { AuthUser } from "~/core/domain/user";

import { emptySitzungstag, messages } from "./schema";
import { action, loader } from "./sitzungstag";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/users/sitzungstage.server", () => ({
  listSitzungstage: vi.fn(),
  addSitzungstag: vi.fn(),
  updateSitzungstag: vi.fn(),
}));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const judge: AuthUser = {
  id: "j1",
  name: "Judge A",
  email: "judge.a@example.com",
  roles: ["richter"],
};

const tuesday = { id: "s1", weekday: 2 as const, start: 9 * 60, end: 12 * 60 };
const thursday = { id: "s2", weekday: 4 as const, start: 9 * 60, end: 16 * 60 };

const url = (id: string) => `http://localhost/einstellungen/sitzungstage/${id}`;
const get = (id: string) => ({ request: new Request(url(id)), params: { sitzungstagId: id } });
const post = (id: string, body: Record<string, string>) => ({
  request: new Request(url(id), { method: "POST", body: new URLSearchParams(body) }),
  params: { sitzungstagId: id },
});

const fields = (overrides: Record<string, string> = {}) => ({
  weekday: "2",
  startHour: "13",
  startMinute: "00",
  endHour: "17",
  endMinute: "00",
  ...overrides,
});

describe("sitzungstag route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(listSitzungstage).mockResolvedValue([tuesday, thursday]);
    vi.mocked(addSitzungstag).mockResolvedValue({ ...tuesday, id: "new" });
    vi.mocked(updateSitzungstag).mockResolvedValue(true);
  });

  it("requires the richter role to load and to submit", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Response("Forbidden", { status: 403 }));

    expect(await callLoader(loader, get("neu"))).toMatchObject({ thrown: true, status: 403 });
    expect(await callAction(action, post("neu", fields()))).toMatchObject({
      thrown: true,
      status: 403,
    });
    expect(requireRole).toHaveBeenCalledWith(expect.any(Request), "richter");
    expect(addSitzungstag).not.toHaveBeenCalled();
  });

  describe("loader", () => {
    it("starts a new Sitzungstag empty", async () => {
      expect(await callLoader(loader, get("neu"))).toMatchObject({
        thrown: false,
        data: { user: judge, values: emptySitzungstag },
      });
    });

    it("fills in a saved Sitzungstag of the judge", async () => {
      expect(await callLoader(loader, get("s2"))).toMatchObject({
        data: {
          values: {
            weekday: "4",
            startHour: "09",
            startMinute: "00",
            endHour: "16",
            endMinute: "00",
          },
        },
      });
      expect(listSitzungstage).toHaveBeenCalledWith({ db: true }, "j1");
    });

    it("answers 404 for an id the judge does not have", async () => {
      expect(await callLoader(loader, get("someone-elses"))).toMatchObject({
        thrown: true,
        status: 404,
      });
    });
  });

  describe("action", () => {
    it("adds a new Sitzungstag, also on a weekday that already has one, and shows the list", async () => {
      const outcome = await callAction(action, post("neu", fields()));

      expect(outcome).toMatchObject({ status: 302, location: "/einstellungen" });
      expect(addSitzungstag).toHaveBeenCalledWith({ db: true }, "j1", {
        weekday: 2,
        start: 13 * 60,
        end: 17 * 60,
      });
      expect(updateSitzungstag).not.toHaveBeenCalled();
    });

    it("changes a saved Sitzungstag, which may overlap its own old times", async () => {
      const outcome = await callAction(
        action,
        post("s1", fields({ startHour: "10", endHour: "11" })),
      );

      expect(outcome).toMatchObject({ status: 302, location: "/einstellungen" });
      expect(updateSitzungstag).toHaveBeenCalledWith({ db: true }, "j1", "s1", {
        weekday: 2,
        start: 10 * 60,
        end: 11 * 60,
      });
      expect(addSitzungstag).not.toHaveBeenCalled();
    });

    it("rejects an overlap with another Sitzungstag and keeps what was typed", async () => {
      const typed = fields({ startHour: "11" });
      const outcome = await callAction(action, post("neu", typed));

      expect(outcome).toMatchObject({
        thrown: false,
        status: 400,
        data: {
          values: typed,
          errors: { overlap: messages.overlap("Dienstag, 09:00 bis 12:00") },
        },
      });
      expect(addSitzungstag).not.toHaveBeenCalled();
    });

    it("rejects an incomplete form", async () => {
      const outcome = await callAction(action, post("neu", fields({ weekday: "", endHour: "" })));

      expect(outcome).toMatchObject({
        status: 400,
        data: { errors: { weekday: messages.weekday, end: messages.end } },
      });
      expect(addSitzungstag).not.toHaveBeenCalled();
    });

    it("answers 404 for an id the judge does not have", async () => {
      expect(await callAction(action, post("someone-elses", fields()))).toMatchObject({
        thrown: true,
        status: 404,
      });
      expect(updateSitzungstag).not.toHaveBeenCalled();
    });

    it("answers 404 when the Sitzungstag was deleted meanwhile", async () => {
      vi.mocked(updateSitzungstag).mockResolvedValue(false);

      expect(await callAction(action, post("s1", fields()))).toMatchObject({
        thrown: true,
        status: 404,
      });
    });
  });
});
