// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDraftAppointment,
  getAppointment,
  updateDraftAppointment,
} from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import type { AuthUser } from "~/core/domain/user";

import { action, loader } from "../create-termin";
import { emptySlot, type SlotInput } from "../create-termin.schema";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/appointments/appointments.server", () => ({
  createDraftAppointment: vi.fn(),
  getAppointment: vi.fn(),
  updateDraftAppointment: vi.fn(),
}));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const judge: AuthUser = {
  id: "1",
  name: "Muthig",
  email: "muthig@justiz.niedersachsen.de",
  roles: ["richter"],
};

// Far in the future so the "no past dates" rule never trips these tests.
const slot = (day: string): SlotInput => ({
  ...emptySlot,
  day,
  month: "1",
  year: "2099",
  startHour: "9",
  startMinute: "0",
  endHour: "10",
  endMinute: "0",
});

// 09:00 to 10:00 Berlin time in January is 08:00 to 09:00 UTC.
const range = (day: string) => ({
  start: new Date(`2099-01-${day.padStart(2, "0")}T08:00:00Z`),
  end: new Date(`2099-01-${day.padStart(2, "0")}T09:00:00Z`),
});

function postRequest(aktenzeichen: string, slots: SlotInput[], appointmentId?: string) {
  const form = new FormData();
  if (appointmentId) form.set("appointmentId", appointmentId);
  form.set("aktenzeichen", aktenzeichen);
  slots.forEach((row, index) => {
    for (const [field, value] of Object.entries(row)) form.set(`slots.${index}.${field}`, value);
  });
  return new Request("http://localhost/overview/new", { method: "POST", body: form });
}

type DataResponse = { data: unknown; init: { status?: number } | null };

describe("create-termin route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(createDraftAppointment).mockResolvedValue("new-id");
    vi.mocked(updateDraftAppointment).mockResolvedValue(true);
  });

  describe("access control", () => {
    it("requires the richter role to load the page", async () => {
      const forbidden = new Response("Forbidden", { status: 403 });
      vi.mocked(requireRole).mockRejectedValue(forbidden);
      const request = new Request("http://localhost/overview/new");

      await expect(loader({ request })).rejects.toBe(forbidden);
      expect(requireRole).toHaveBeenCalledWith(request, "richter");
    });

    it("requires the richter role before reading a submission", async () => {
      const forbidden = new Response("Forbidden", { status: 403 });
      vi.mocked(requireRole).mockRejectedValue(forbidden);
      const request = postRequest("A 1", [slot("5"), slot("6")]);
      const formData = vi.spyOn(request, "formData");

      await expect(action({ request })).rejects.toBe(forbidden);
      expect(requireRole).toHaveBeenCalledWith(request, "richter");
      expect(formData).not.toHaveBeenCalled();
      expect(createDraftAppointment).not.toHaveBeenCalled();
    });
  });

  describe("loading", () => {
    it("returns the signed-in user and no draft for a new Terminumfrage", async () => {
      const request = new Request("http://localhost/overview/new");
      await expect(loader({ request })).resolves.toEqual({ user: judge, draft: null });
      expect(getAppointment).not.toHaveBeenCalled();
    });

    it("returns the saved draft as form values when reopened", async () => {
      vi.mocked(getAppointment).mockResolvedValue({
        id: "d1",
        status: "draft",
        aktenzeichen: "A 1",
        slots: [range("5"), range("6")],
      });
      const request = new Request("http://localhost/overview/new?entwurf=d1");

      const result = await loader({ request });

      expect(getAppointment).toHaveBeenCalledWith({ db: true }, "1", "d1");
      expect(result.draft).toEqual({
        id: "d1",
        values: {
          aktenzeichen: "A 1",
          slots: [
            {
              day: "05",
              month: "01",
              year: "2099",
              startHour: "09",
              startMinute: "00",
              endHour: "10",
              endMinute: "00",
            },
            {
              day: "06",
              month: "01",
              year: "2099",
              startHour: "09",
              startMinute: "00",
              endHour: "10",
              endMinute: "00",
            },
          ],
        },
      });
    });

    it("answers 404 for a draft that does not exist or belongs to someone else", async () => {
      vi.mocked(getAppointment).mockResolvedValue(undefined);
      const request = new Request("http://localhost/overview/new?entwurf=nope");

      await expect(loader({ request })).rejects.toMatchObject({ init: { status: 404 } });
    });

    it("sends the user to the overview when the appointment is already published", async () => {
      vi.mocked(getAppointment).mockResolvedValue({
        id: "d1",
        status: "open",
        aktenzeichen: "A 1",
        slots: [range("5")],
      });
      const request = new Request("http://localhost/overview/new?entwurf=d1");

      await expect(loader({ request })).rejects.toMatchObject({ status: 302 });
    });
  });

  describe("submitting", () => {
    it("saves a draft and redirects to its confirmation page", async () => {
      const response = await action({ request: postRequest("A 1", [slot("5"), slot("6")]) });

      expect(createDraftAppointment).toHaveBeenCalledWith({ db: true }, "1", {
        aktenzeichen: "A 1",
        slots: [range("5"), range("6")],
      });
      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toBe("/overview/new-id/confirm");
    });

    it("stores the trimmed Aktenzeichen without empty rows", async () => {
      await action({ request: postRequest("  A 1  ", [slot("5"), emptySlot, slot("6")]) });

      expect(createDraftAppointment).toHaveBeenCalledWith({ db: true }, "1", {
        aktenzeichen: "A 1",
        slots: [range("5"), range("6")],
      });
    });

    it("updates the existing draft when reopened from the review", async () => {
      const response = await action({
        request: postRequest("A 2", [slot("7"), slot("8")], "d1"),
      });

      expect(updateDraftAppointment).toHaveBeenCalledWith({ db: true }, "1", "d1", {
        aktenzeichen: "A 2",
        slots: [range("7"), range("8")],
      });
      expect(createDraftAppointment).not.toHaveBeenCalled();
      expect((response as Response).headers.get("Location")).toBe("/overview/d1/confirm");
    });

    it("answers 404 when the draft to update is not the user's draft", async () => {
      vi.mocked(updateDraftAppointment).mockResolvedValue(false);

      await expect(
        action({ request: postRequest("A 2", [slot("7"), slot("8")], "other") }),
      ).rejects.toMatchObject({ init: { status: 404 } });
    });

    it("answers 400 with the errors and the submitted values when invalid, saving nothing", async () => {
      const rows = [slot("5"), { ...slot("6"), day: "40" }];
      const response = (await action({ request: postRequest("", rows) })) as DataResponse & {
        data: { values: { slots: SlotInput[] }; errors: Record<string, any> };
      };

      expect(response.init?.status).toBe(400);
      expect(response.data.errors.aktenzeichen).toBe("Geben Sie ein Aktenzeichen an.");
      expect(response.data.errors.rows[1]?.date).toBe("Geben Sie ein gültiges Datum an.");
      expect(response.data.values.slots).toEqual(rows);
      expect(createDraftAppointment).not.toHaveBeenCalled();
      expect(updateDraftAppointment).not.toHaveBeenCalled();
    });

    it("answers 400 for a submission without any fields", async () => {
      const request = new Request("http://localhost/overview/new", {
        method: "POST",
        body: new FormData(),
      });
      const response = (await action({ request })) as DataResponse & {
        data: { errors: Record<string, any> };
      };

      expect(response.init?.status).toBe(400);
      expect(response.data.errors.aktenzeichen).toBe("Geben Sie ein Aktenzeichen an.");
      expect(response.data.errors.slots).toBe("Geben Sie mindestens zwei Zeitfenster an.");
    });

    it("answers 400 when only one window is given", async () => {
      const response = (await action({
        request: postRequest("A 1", [slot("5")]),
      })) as DataResponse & { data: { errors: Record<string, any> } };

      expect(response.init?.status).toBe(400);
      expect(response.data.errors.slots).toBe("Geben Sie mindestens zwei Zeitfenster an.");
      expect(createDraftAppointment).not.toHaveBeenCalled();
    });
  });
});
