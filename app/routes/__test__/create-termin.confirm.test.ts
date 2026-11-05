// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getAppointment,
  nextCalendarSequence,
  publishAppointment,
} from "~/adapters/appointments/appointments.server";
import { listParticipants } from "~/adapters/appointments/participants.server";
import { requireRole } from "~/adapters/session/session";
import type { AuthUser } from "~/core/domain/user";
import { sendTerminCreatedEmail } from "~/lib/email/send-termin-created-email";

import { action, loader } from "../create-termin.confirm";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/appointments/appointments.server", () => ({
  getAppointment: vi.fn(),
  nextCalendarSequence: vi.fn(),
  publishAppointment: vi.fn(),
}));
vi.mock("~/adapters/appointments/participants.server", () => ({ listParticipants: vi.fn() }));
vi.mock("~/lib/email/send-termin-created-email", () => ({ sendTerminCreatedEmail: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const judge: AuthUser = {
  id: "1",
  name: "Judge A",
  email: "judge.a@example.com",
  roles: ["richter"],
};

const published = {
  id: "d1",
  status: "open" as const,
  aktenzeichen: "574 C 65412/26",
  slots: [
    { id: "s1", start: new Date("2026-09-17T07:00:00Z"), end: new Date("2026-09-17T08:30:00Z") },
  ],
};

// Far in the future, so the "no past dates" rule never trips these tests. 09:00 to 10:30 Berlin
// time in January is 08:00 to 09:30 UTC.
const completeDraft = {
  id: "d1",
  status: "draft" as const,
  aktenzeichen: "574 C 65412/26",
  slots: [
    { id: "s1", start: new Date("2099-01-05T08:00:00Z"), end: new Date("2099-01-05T09:30:00Z") },
    { id: "s2", start: new Date("2099-01-06T08:00:00Z"), end: new Date("2099-01-06T09:30:00Z") },
  ],
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
    vi.mocked(getAppointment).mockResolvedValue(published);
    vi.mocked(nextCalendarSequence).mockResolvedValue(1);
    vi.mocked(listParticipants).mockResolvedValue([
      { id: "p1", email: "person.a@example.com", name: "Person A" },
    ]);
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
      vi.mocked(getAppointment).mockResolvedValue(completeDraft);

      const result = await loader({ request: new Request(url), params });

      expect(getAppointment).toHaveBeenCalledWith({ db: true }, "1", "d1");
      expect(listParticipants).toHaveBeenCalledWith({ db: true }, "1", "d1");
      expect(result.participants).toEqual([
        { id: "p1", email: "person.a@example.com", name: "Person A" },
      ]);
      expect(result.values).toEqual({
        aktenzeichen: "574 C 65412/26",
        slots: [
          {
            day: "05",
            month: "01",
            year: "2099",
            startHour: "09",
            startMinute: "00",
            endHour: "10",
            endMinute: "30",
          },
          {
            day: "06",
            month: "01",
            year: "2099",
            startHour: "09",
            startMinute: "00",
            endHour: "10",
            endMinute: "30",
          },
        ],
      });
    });

    it.each([
      ["has no Aktenzeichen yet", { aktenzeichen: " " }],
      ["has only one time slot", { slots: completeDraft.slots.slice(0, 1) }],
      ["has no time slot", { slots: [] }],
      [
        "has a time slot in the past",
        {
          slots: [
            {
              id: "old",
              start: new Date("2020-01-05T08:00:00Z"),
              end: new Date("2020-01-05T09:00:00Z"),
            },
            ...completeDraft.slots.slice(1),
          ],
        },
      ],
    ])("sends the user back to the form for a draft that %s", async (_name, change) => {
      vi.mocked(getAppointment).mockResolvedValue({ ...completeDraft, ...change });

      await expect(loader({ request: new Request(url), params })).rejects.toMatchObject({
        status: 302,
        headers: expect.objectContaining({}),
      });
      const thrown = await loader({ request: new Request(url), params }).catch(
        (error: Response) => error,
      );
      expect((thrown as Response).headers.get("Location")).toBe("/overview/new?entwurf=d1");
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
      vi.mocked(getAppointment).mockResolvedValue(completeDraft);
      const response = (await action({ request: postRequest("create"), params })) as Response;

      expect(publishAppointment).toHaveBeenCalledWith({ db: true }, "1", "d1");
      expect(response.status).toBe(302);
      expect(response.headers.get("Location")).toBe("/overview/d1/created");
    });

    it("does not publish a draft that is no longer complete, but sends it back to the form", async () => {
      vi.mocked(getAppointment).mockResolvedValue({
        ...completeDraft,
        slots: completeDraft.slots.slice(1),
      });

      const response = (await action({ request: postRequest("create"), params })) as Response;

      expect(response.headers.get("Location")).toBe("/overview/new?entwurf=d1");
      expect(publishAppointment).not.toHaveBeenCalled();
      expect(sendTerminCreatedEmail).not.toHaveBeenCalled();
    });

    it("answers 404 when there is no such appointment to publish", async () => {
      vi.mocked(getAppointment).mockResolvedValue(undefined);

      await expect(action({ request: postRequest("create"), params })).rejects.toMatchObject({
        init: { status: 404 },
      });
      expect(publishAppointment).not.toHaveBeenCalled();
    });

    it("e-mails the judge the published Terminumfrage with its time slots", async () => {
      await action({ request: postRequest("create"), params });

      expect(getAppointment).toHaveBeenCalledWith({ db: true }, "1", "d1");
      expect(sendTerminCreatedEmail).toHaveBeenCalledWith({
        to: "judge.a@example.com",
        appointmentId: "d1",
        aktenzeichen: "574 C 65412/26",
        slots: published.slots,
        sequence: 1,
      });
    });

    it("sends no e-mail when the appointment cannot be read after publishing", async () => {
      vi.mocked(nextCalendarSequence).mockResolvedValue(undefined);

      const response = (await action({ request: postRequest("create"), params })) as Response;

      expect(response.headers.get("Location")).toBe("/overview/d1/created");
      expect(sendTerminCreatedEmail).not.toHaveBeenCalled();
    });

    it("answers 404 and sends no e-mail when there is no draft to publish", async () => {
      vi.mocked(publishAppointment).mockResolvedValue(false);

      await expect(action({ request: postRequest("create"), params })).rejects.toMatchObject({
        init: { status: 404 },
      });
      expect(sendTerminCreatedEmail).not.toHaveBeenCalled();
    });

    it("sends no e-mail when going back", async () => {
      await action({ request: postRequest("back"), params });
      expect(sendTerminCreatedEmail).not.toHaveBeenCalled();
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
