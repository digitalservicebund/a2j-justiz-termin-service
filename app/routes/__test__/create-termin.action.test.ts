// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDraftAppointment,
  deleteDraftIfEmpty,
  deleteDraftSlot,
  getAppointment,
  updateDraftAktenzeichen,
} from "~/adapters/appointments/appointments.server";
import {
  deleteDraftParticipant,
  listParticipants,
} from "~/adapters/appointments/participants.server";
import { requireRole } from "~/adapters/session/session";
import type { AuthUser } from "~/core/domain/user";

import { action, loader } from "../create-termin";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/appointments/appointments.server", () => ({
  createDraftAppointment: vi.fn(),
  deleteDraftIfEmpty: vi.fn(),
  deleteDraftSlot: vi.fn(),
  getAppointment: vi.fn(),
  updateDraftAktenzeichen: vi.fn(),
}));
vi.mock("~/adapters/appointments/participants.server", () => ({
  deleteDraftParticipant: vi.fn(),
  listParticipants: vi.fn(),
}));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const judge: AuthUser = {
  id: "1",
  name: "Judge A",
  email: "judge.a@example.com",
  roles: ["richter"],
};

// 09:00 to 10:00 Berlin time in January is 08:00 to 09:00 UTC. Far in the future, so the "no
// past dates" rule never trips these tests.
const stored = (day: string) => ({
  id: `s${day}`,
  start: new Date(`2099-01-${day.padStart(2, "0")}T08:00:00Z`),
  end: new Date(`2099-01-${day.padStart(2, "0")}T09:00:00Z`),
});

function post(fields: Record<string, string>) {
  return new Request("http://localhost/overview/new", {
    method: "POST",
    body: new URLSearchParams(fields),
  });
}

type DataResponse = { data: Record<string, any>; init: { status?: number } | null };

const location = (response: unknown) => (response as Response).headers.get("Location");

describe("create-termin route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(createDraftAppointment).mockResolvedValue("new-id");
    vi.mocked(updateDraftAktenzeichen).mockResolvedValue(true);
    vi.mocked(deleteDraftSlot).mockResolvedValue(true);
    vi.mocked(deleteDraftParticipant).mockResolvedValue(true);
    vi.mocked(listParticipants).mockResolvedValue([
      { id: "p1", email: "person.a@example.com", name: null },
      { id: "p2", email: null, name: "Person B" },
    ]);
    vi.mocked(getAppointment).mockResolvedValue({
      id: "d1",
      status: "draft",
      aktenzeichen: "A 1",
      slots: [stored("5"), stored("6")],
    });
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
      const request = post({ intent: "add-slot", aktenzeichen: "A 1" });
      const formData = vi.spyOn(request, "formData");

      await expect(action({ request })).rejects.toBe(forbidden);
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

    it("describes the slots of a reopened draft for the table", async () => {
      const request = new Request("http://localhost/overview/new?entwurf=d1");

      const result = await loader({ request });

      expect(getAppointment).toHaveBeenCalledWith({ db: true }, "1", "d1");
      expect(result.draft).toMatchObject({
        id: "d1",
        aktenzeichen: "A 1",
        participants: [
          { id: "p1", email: "person.a@example.com", name: null },
          { id: "p2", email: null, name: "Person B" },
        ],
        slots: [
          { id: "s5", date: "5. Januar 2099", time: "09:00 bis 10:00" },
          { id: "s6", date: "6. Januar 2099", time: "09:00 bis 10:00" },
        ],
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
        slots: [stored("5")],
      });
      const request = new Request("http://localhost/overview/new?entwurf=d1");

      await expect(loader({ request })).rejects.toMatchObject({ status: 302 });
    });
  });

  describe("leaving for a slot page", () => {
    it("creates the draft with the Aktenzeichen on the first visit to the slot page", async () => {
      const response = await action({
        request: post({ intent: "add-slot", aktenzeichen: "  A 1 " }),
      });

      expect(createDraftAppointment).toHaveBeenCalledWith({ db: true }, "1", "A 1");
      expect(location(response)).toBe("/overview/new-id/zeitfenster/neu");
    });

    it("creates a draft even when nothing was typed yet", async () => {
      const response = await action({ request: post({ intent: "add-slot", aktenzeichen: "" }) });

      expect(createDraftAppointment).toHaveBeenCalledWith({ db: true }, "1", "");
      expect(location(response)).toBe("/overview/new-id/zeitfenster/neu");
    });

    it("saves the typed Aktenzeichen into the existing draft instead of creating another", async () => {
      const response = await action({
        request: post({ intent: "add-slot", aktenzeichen: "A 2", appointmentId: "d1" }),
      });

      expect(updateDraftAktenzeichen).toHaveBeenCalledWith({ db: true }, "1", "d1", "A 2");
      expect(createDraftAppointment).not.toHaveBeenCalled();
      expect(location(response)).toBe("/overview/d1/zeitfenster/neu");
    });

    it.each([
      ["edit-slot:s5", "/overview/d1/zeitfenster/s5"],
      ["copy-slot:s5", "/overview/d1/zeitfenster/neu?kopie=s5"],
    ])("%s opens the slot page", async (intent, expected) => {
      const response = await action({
        request: post({ intent, aktenzeichen: "A 1", appointmentId: "d1" }),
      });

      expect(updateDraftAktenzeichen).toHaveBeenCalledOnce();
      expect(location(response)).toBe(expected);
    });

    it("answers 404 when the draft to save into is not the user's draft", async () => {
      vi.mocked(updateDraftAktenzeichen).mockResolvedValue(false);

      await expect(
        action({ request: post({ intent: "add-slot", aktenzeichen: "A", appointmentId: "x" }) }),
      ).rejects.toMatchObject({ init: { status: 404 } });
    });

    it("refuses an Aktenzeichen that is too long, without saving or leaving", async () => {
      const response = (await action({
        request: post({ intent: "add-slot", aktenzeichen: "A".repeat(51) }),
      })) as unknown as DataResponse;

      expect(response.init?.status).toBe(400);
      expect(response.data.errors.aktenzeichen).toBe(
        "Das Aktenzeichen darf höchstens 50 Zeichen lang sein.",
      );
      expect(createDraftAppointment).not.toHaveBeenCalled();
    });
  });

  describe("people", () => {
    it.each([
      ["add-person", "/overview/d1/verfahrensbeteiligte/neu"],
      ["edit-person:p1", "/overview/d1/verfahrensbeteiligte/p1"],
    ])("%s saves the Aktenzeichen and opens the page of the person", async (intent, expected) => {
      const response = await action({
        request: post({ intent, aktenzeichen: "A 2", appointmentId: "d1" }),
      });

      expect(updateDraftAktenzeichen).toHaveBeenCalledWith({ db: true }, "1", "d1", "A 2");
      expect(location(response)).toBe(expected);
    });

    it("creates the draft first when the person is the first thing added", async () => {
      const response = await action({
        request: post({ intent: "add-person", aktenzeichen: "A 1" }),
      });

      expect(createDraftAppointment).toHaveBeenCalledWith({ db: true }, "1", "A 1");
      expect(location(response)).toBe("/overview/new-id/verfahrensbeteiligte/neu");
    });

    it("deletes a person at once and returns to the form", async () => {
      const response = await action({
        request: post({ intent: "delete-person:p1", aktenzeichen: "A 1", appointmentId: "d1" }),
      });

      expect(deleteDraftParticipant).toHaveBeenCalledWith({ db: true }, "1", "d1", "p1");
      expect(location(response)).toBe("/overview/new?entwurf=d1");
    });

    it("answers 404 for a person that is not in the user's draft", async () => {
      vi.mocked(deleteDraftParticipant).mockResolvedValue(false);

      await expect(
        action({
          request: post({ intent: "delete-person:x", aktenzeichen: "A", appointmentId: "d1" }),
        }),
      ).rejects.toMatchObject({ init: { status: 404 } });
    });

    it("goes to the review without any person", async () => {
      vi.mocked(listParticipants).mockResolvedValue([]);

      const response = await action({
        request: post({ intent: "next", aktenzeichen: "A 1", appointmentId: "d1" }),
      });

      expect(location(response)).toBe("/overview/d1/confirm");
    });
  });

  describe("deleting a slot", () => {
    it("deletes it and returns to the form", async () => {
      const response = await action({
        request: post({ intent: "delete-slot:s5", aktenzeichen: "A 1", appointmentId: "d1" }),
      });

      expect(deleteDraftSlot).toHaveBeenCalledWith({ db: true }, "1", "d1", "s5");
      expect(location(response)).toBe("/overview/new?entwurf=d1");
    });

    it("answers 404 for a slot that is not in the user's draft", async () => {
      vi.mocked(deleteDraftSlot).mockResolvedValue(false);

      await expect(
        action({
          request: post({ intent: "delete-slot:nope", aktenzeichen: "A", appointmentId: "d1" }),
        }),
      ).rejects.toMatchObject({ init: { status: 404 } });
    });
  });

  describe("continuing to the review", () => {
    it("goes to the review of a complete draft", async () => {
      const response = await action({
        request: post({ intent: "next", aktenzeichen: "A 1", appointmentId: "d1" }),
      });

      expect(updateDraftAktenzeichen).toHaveBeenCalledWith({ db: true }, "1", "d1", "A 1");
      expect(location(response)).toBe("/overview/d1/confirm");
    });

    it("needs an Aktenzeichen, and keeps what was typed", async () => {
      const response = (await action({
        request: post({ intent: "next", aktenzeichen: "  ", appointmentId: "d1" }),
      })) as unknown as DataResponse;

      expect(response.init?.status).toBe(400);
      expect(response.data.errors.aktenzeichen).toBe("Geben Sie ein Aktenzeichen an.");
      expect(response.data.aktenzeichen).toBe("  ");
      expect(updateDraftAktenzeichen).not.toHaveBeenCalled();
    });

    it("needs at least two slots", async () => {
      vi.mocked(getAppointment).mockResolvedValue({
        id: "d1",
        status: "draft",
        aktenzeichen: "A 1",
        slots: [stored("5")],
      });

      const response = (await action({
        request: post({ intent: "next", aktenzeichen: "A 1", appointmentId: "d1" }),
      })) as unknown as DataResponse;

      expect(response.init?.status).toBe(400);
      expect(response.data.errors.slots).toBe("Geben Sie mindestens zwei Zeitfenster an.");
    });

    it("reports what is missing when nothing was entered and no draft exists", async () => {
      const response = (await action({
        request: post({ intent: "next", aktenzeichen: "A 1" }),
      })) as unknown as DataResponse;

      expect(response.init?.status).toBe(400);
      expect(response.data.errors.slots).toBe("Geben Sie mindestens zwei Zeitfenster an.");
      expect(createDraftAppointment).not.toHaveBeenCalled();
      expect(getAppointment).not.toHaveBeenCalled();
    });

    it("flags a saved slot that lies in the past by now", async () => {
      vi.mocked(getAppointment).mockResolvedValue({
        id: "d1",
        status: "draft",
        aktenzeichen: "A 1",
        slots: [
          {
            id: "old",
            start: new Date("2020-01-05T08:00:00Z"),
            end: new Date("2020-01-05T09:00:00Z"),
          },
          stored("6"),
        ],
      });

      const response = (await action({
        request: post({ intent: "next", aktenzeichen: "A 1", appointmentId: "d1" }),
      })) as unknown as DataResponse;

      expect(response.init?.status).toBe(400);
      expect(response.data.errors.rows[0].date).toBe(
        "Das Datum darf nicht in der Vergangenheit liegen.",
      );
    });
  });

  describe("cancelling", () => {
    it("removes an empty draft and returns to the overview", async () => {
      const response = await action({
        request: post({ intent: "cancel", aktenzeichen: "", appointmentId: "d1" }),
      });

      expect(deleteDraftIfEmpty).toHaveBeenCalledWith({ db: true }, "1", "d1");
      expect(location(response)).toBe("/overview");
    });

    it("has nothing to remove before a draft exists", async () => {
      const response = await action({ request: post({ intent: "cancel", aktenzeichen: "A" }) });

      expect(deleteDraftIfEmpty).not.toHaveBeenCalled();
      expect(createDraftAppointment).not.toHaveBeenCalled();
      expect(location(response)).toBe("/overview");
    });
  });

  it("answers 400 for an unknown intent", async () => {
    await expect(
      action({ request: post({ intent: "explode", aktenzeichen: "A", appointmentId: "d1" }) }),
    ).rejects.toMatchObject({ init: { status: 400 } });
  });
});
