// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import type { AuthUser } from "~/core/domain/user";

import { loader } from "../create-termin.created";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/appointments/appointments.server", () => ({ getAppointment: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const judge: AuthUser = {
  id: "1",
  name: "Judge A",
  email: "judge.a@example.com",
  roles: ["richter"],
};

const params = { appointmentId: "a1" };
const request = () => new Request("http://localhost:3000/overview/a1/created");

describe("create-termin created route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(judge);
  });

  it("requires the richter role", async () => {
    const forbidden = new Response("Forbidden", { status: 403 });
    vi.mocked(requireRole).mockRejectedValue(forbidden);

    await expect(loader({ request: request(), params })).rejects.toBe(forbidden);
    expect(getAppointment).not.toHaveBeenCalled();
  });

  it("lists the proposed windows per day and the survey link of a published appointment", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "open",
      universalToken: "tok1",
      aktenzeichen: "574 C 65412/26",
      // 10:00 and 14:00 Berlin time in summer are 08:00 and 12:00 UTC.
      slots: [
        { start: new Date("2026-09-24T12:00:00Z"), end: new Date("2026-09-24T13:00:00Z") },
        { start: new Date("2026-09-17T08:00:00Z"), end: new Date("2026-09-17T09:00:00Z") },
      ],
    });

    const result = await loader({ request: request(), params });

    expect(getAppointment).toHaveBeenCalledWith({ db: true }, "1", "a1");
    expect(result.days).toEqual([
      { key: "2026-09-17", label: "17. September 2026", times: ["10:00 – 11:00"] },
      { key: "2026-09-24", label: "24. September 2026", times: ["14:00 – 15:00"] },
    ]);
    expect(result.surveyUrl).toBe("http://localhost:3000/umfrage/tok1");
  });

  it("answers 404 for a published appointment without a survey token", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "open",
      universalToken: null,
      aktenzeichen: "574 C 65412/26",
      slots: [],
    });

    await expect(loader({ request: request(), params })).rejects.toMatchObject({
      init: { status: 404 },
    });
  });

  it("answers 404 for an unknown appointment or one of another user", async () => {
    vi.mocked(getAppointment).mockResolvedValue(undefined);

    await expect(loader({ request: request(), params })).rejects.toMatchObject({
      init: { status: 404 },
    });
  });

  it("sends a draft back to its review", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "draft",
      aktenzeichen: "A 1",
      slots: [],
    });

    const thrown = await loader({ request: request(), params }).catch((error: Response) => error);

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(302);
    expect((thrown as Response).headers.get("Location")).toBe("/overview/a1/confirm");
  });
});
