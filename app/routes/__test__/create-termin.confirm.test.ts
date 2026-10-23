// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAppointment, publishAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import type { AuthUser } from "~/core/domain/user";

import { action, loader } from "../create-termin.confirm";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/appointments/appointments.server", () => ({
  getAppointment: vi.fn(),
  publishAppointment: vi.fn(),
}));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const judge: AuthUser = {
  id: "1",
  name: "Judge A",
  email: "judge.a@example.com",
  roles: ["richter"],
};

const params = { appointmentId: "d1" };
const url = "http://localhost/overview/d1/confirm";

function postRequest(intent?: string) {
  const form = new FormData();
  if (intent) form.set("intent", intent);
  return new Request(url, { method: "POST", body: form });
}

describe("create-termin confirm route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(publishAppointment).mockResolvedValue(true);
  });

  describe("access control", () => {
    it("requires the richter role to load and to submit", async () => {
      const forbidden = new Response("Forbidden", { status: 403 });
      vi.mocked(requireRole).mockRejectedValue(forbidden);

      await expect(loader({ request: new Request(url), params })).rejects.toBe(forbidden);
      await expect(action({ request: postRequest("create"), params })).rejects.toBe(forbidden);
      expect(getAppointment).not.toHaveBeenCalled();
      expect(publishAppointment).not.toHaveBeenCalled();
    });
  });

  describe("loading", () => {
    it("reads the draft from the database for the signed-in user", async () => {
      vi.mocked(getAppointment).mockResolvedValue({
        id: "d1",
        status: "draft",
        aktenzeichen: "574 C 65412/26",
        // 09:00 and 10:30 Berlin time in summer are 07:00 and 08:30 UTC.
        slots: [{ start: new Date("2026-09-17T07:00:00Z"), end: new Date("2026-09-17T08:30:00Z") }],
      });

      const result = await loader({ request: new Request(url), params });

      expect(getAppointment).toHaveBeenCalledWith({ db: true }, "1", "d1");
      expect(result.values).toEqual({
        aktenzeichen: "574 C 65412/26",
        slots: [
          {
            day: "17",
            month: "09",
            year: "2026",
            startHour: "09",
            startMinute: "00",
            endHour: "10",
            endMinute: "30",
          },
        ],
      });
    });

    it("answers 404 for an unknown appointment or one of another user", async () => {
      vi.mocked(getAppointment).mockResolvedValue(undefined);

      await expect(loader({ request: new Request(url), params })).rejects.toMatchObject({
        init: { status: 404 },
      });
    });

    it("redirects to the overview once the appointment is published", async () => {
      vi.mocked(getAppointment).mockResolvedValue({
        id: "d1",
        status: "open",
        aktenzeichen: "A 1",
        slots: [],
      });

      await expect(loader({ request: new Request(url), params })).rejects.toMatchObject({
        status: 302,
      });
    });
  });

  describe("submitting", () => {
    it("goes back to the form with the saved draft", async () => {
      const response = (await action({ request: postRequest("back"), params })) as Response;

      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/overview/new?entwurf=d1");
      expect(publishAppointment).not.toHaveBeenCalled();
    });

    it("publishes the draft and shows the next steps", async () => {
      const response = (await action({ request: postRequest("create"), params })) as Response;

      expect(publishAppointment).toHaveBeenCalledWith({ db: true }, "1", "d1");
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/overview/d1/created");
    });

    it("answers 404 when there is no draft to publish", async () => {
      vi.mocked(publishAppointment).mockResolvedValue(false);

      await expect(action({ request: postRequest("create"), params })).rejects.toMatchObject({
        init: { status: 404 },
      });
    });

    it("rejects an unknown intent", async () => {
      await expect(action({ request: postRequest("delete"), params })).rejects.toMatchObject({
        init: { status: 400 },
      });
      await expect(action({ request: postRequest(), params })).rejects.toMatchObject({
        init: { status: 400 },
      });
      expect(publishAppointment).not.toHaveBeenCalled();
    });
  });
});
