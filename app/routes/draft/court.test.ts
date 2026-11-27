// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { callAction, callLoader } from "~tests/route";

import { getAppointment, setDraftCourt } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import { getDefaultCourt, setDefaultCourt } from "~/adapters/users/richter.server";
import type { AuthUser } from "~/core/domain/user";

import { action, loader } from "./court";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/appointments/appointments.server", () => ({
  getAppointment: vi.fn(),
  setDraftCourt: vi.fn(),
}));
vi.mock("~/adapters/users/richter.server", () => ({
  getDefaultCourt: vi.fn(),
  setDefaultCourt: vi.fn(),
}));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const judge: AuthUser = {
  id: "1",
  name: "Judge A",
  email: "judge.a@example.com",
  roles: ["richter"],
};

const params = { appointmentId: "d1" };
const url = "http://localhost/overview/d1/gericht";
const draft = {
  id: "d1",
  status: "draft" as const,
  aktenzeichen: "A 1",
  courtCode: "B2402",
  slots: [],
};

const post = (fields: Record<string, string>) => ({
  request: new Request(url, { method: "POST", body: new URLSearchParams(fields) }),
  params,
});

describe("court page of a draft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(getAppointment).mockResolvedValue(draft);
    vi.mocked(setDraftCourt).mockResolvedValue(true);
    vi.mocked(getDefaultCourt).mockResolvedValue(null);
  });

  it("requires the richter role", async () => {
    vi.mocked(requireRole).mockRejectedValue(new Response("Forbidden", { status: 403 }));

    expect(await callLoader(loader, { request: new Request(url), params })).toMatchObject({
      thrown: true,
      status: 403,
    });
    expect(await callAction(action, post({ courtCode: "D2000" }))).toMatchObject({
      thrown: true,
      status: 403,
    });
    expect(setDraftCourt).not.toHaveBeenCalled();
  });

  it("starts with the court of the draft", async () => {
    vi.mocked(getDefaultCourt).mockResolvedValue("D2000");

    expect(await callLoader(loader, { request: new Request(url), params })).toMatchObject({
      data: { courtCode: "B2402", hasDefaultCourt: true, cancelHref: "/overview/new?entwurf=d1" },
    });
  });

  it("starts with the default court for a draft without one", async () => {
    vi.mocked(getAppointment).mockResolvedValue({ ...draft, courtCode: null });
    vi.mocked(getDefaultCourt).mockResolvedValue("D2000");

    expect(await callLoader(loader, { request: new Request(url), params })).toMatchObject({
      data: { courtCode: "D2000" },
    });
  });

  it("sends a published Terminumfrage to the overview", async () => {
    vi.mocked(getAppointment).mockResolvedValue({ ...draft, status: "open" });

    expect(await callLoader(loader, { request: new Request(url), params })).toMatchObject({
      thrown: true,
      location: "/overview",
    });
    expect(await callAction(action, post({ courtCode: "D2000" }))).toMatchObject({
      thrown: true,
      location: "/overview",
    });
    expect(setDraftCourt).not.toHaveBeenCalled();
  });

  it("saves the court of the draft and returns to the form", async () => {
    const outcome = await callAction(action, post({ courtCode: "D2000" }));

    expect(setDraftCourt).toHaveBeenCalledWith({ db: true }, "1", "d1", "D2000");
    expect(setDefaultCourt).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ status: 302, location: "/overview/new?entwurf=d1" });
  });

  it("also saves it as the default when asked and the judge has none", async () => {
    await callAction(action, post({ courtCode: "D2000", saveAsDefault: "on" }));

    expect(setDefaultCourt).toHaveBeenCalledWith({ db: true }, "1", "D2000");
  });

  it("never overwrites a default court", async () => {
    vi.mocked(getDefaultCourt).mockResolvedValue("B2402");

    await callAction(action, post({ courtCode: "D2000", saveAsDefault: "on" }));

    expect(setDefaultCourt).not.toHaveBeenCalled();
  });

  it.each([
    ["no court", "", "Wählen Sie ein Gericht aus."],
    ["a court that is not in the list", "A1000S", "Wählen Sie ein Gericht aus der Liste aus."],
  ])("rejects %s", async (_, courtCode, error) => {
    expect(await callAction(action, post({ courtCode }))).toMatchObject({
      status: 400,
      data: { courtCode, error },
    });
    expect(setDraftCourt).not.toHaveBeenCalled();
  });
});
