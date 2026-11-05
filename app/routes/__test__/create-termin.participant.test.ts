// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import {
  addDraftParticipant,
  listParticipants,
  updateDraftParticipant,
} from "~/adapters/appointments/participants.server";
import { requireRole } from "~/adapters/session/session";
import type { AuthUser } from "~/core/domain/user";

import { action, loader } from "../create-termin.participant";
import { MAX_PARTICIPANTS } from "../create-termin.participant.schema";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/appointments/appointments.server", () => ({ getAppointment: vi.fn() }));
vi.mock("~/adapters/appointments/participants.server", () => ({
  addDraftParticipant: vi.fn(),
  listParticipants: vi.fn(),
  updateDraftParticipant: vi.fn(),
}));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const judge: AuthUser = {
  id: "1",
  name: "Judge A",
  email: "judge.a@example.com",
  roles: ["richter"],
};

const draft = (status: "draft" | "open" = "draft") => ({
  id: "d1",
  status,
  aktenzeichen: "A 1",
  slots: [],
});

const people = [
  { id: "p1", email: "person.a@example.com", name: null },
  { id: "p2", email: null, name: "Person B" },
];

const url = (id: string) => `http://localhost/overview/d1/verfahrensbeteiligte/${id}`;

const post = (id: string, body: Record<string, string>) => ({
  request: new Request(url(id), { method: "POST", body: new URLSearchParams(body) }),
  params: { appointmentId: "d1", participantId: id },
});

const get = (id: string) => ({
  request: new Request(url(id)),
  params: { appointmentId: "d1", participantId: id },
});

type DataResponse = { data: Record<string, any>; init: { status?: number } | null };
const location = (response: unknown) => (response as Response).headers.get("Location");

describe("create-termin participant route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(getAppointment).mockResolvedValue(draft());
    vi.mocked(listParticipants).mockResolvedValue(people);
    vi.mocked(addDraftParticipant).mockResolvedValue(true);
    vi.mocked(updateDraftParticipant).mockResolvedValue(true);
  });

  describe("access control", () => {
    it("requires the richter role to load and to submit", async () => {
      const forbidden = new Response("Forbidden", { status: 403 });
      vi.mocked(requireRole).mockRejectedValue(forbidden);

      await expect(loader(get("neu"))).rejects.toBe(forbidden);
      const submission = post("neu", { email: "person.c@example.com" });
      const formData = vi.spyOn(submission.request, "formData");
      await expect(action(submission)).rejects.toBe(forbidden);
      expect(formData).not.toHaveBeenCalled();
      expect(addDraftParticipant).not.toHaveBeenCalled();
    });

    it("answers 404 for a draft that does not exist or is someone else's", async () => {
      vi.mocked(getAppointment).mockResolvedValue(undefined);

      await expect(loader(get("neu"))).rejects.toMatchObject({ init: { status: 404 } });
      await expect(action(post("neu", { email: "person.c@example.com" }))).rejects.toMatchObject({
        init: { status: 404 },
      });
      expect(addDraftParticipant).not.toHaveBeenCalled();
    });

    it("leaves a published appointment alone", async () => {
      vi.mocked(getAppointment).mockResolvedValue(draft("open"));

      await expect(loader(get("neu"))).rejects.toMatchObject({ status: 302 });
      await expect(action(post("neu", { email: "person.c@example.com" }))).rejects.toMatchObject({
        status: 302,
      });
      expect(addDraftParticipant).not.toHaveBeenCalled();
    });
  });

  describe("loading", () => {
    it("starts a new person empty and links back to the form", async () => {
      expect(await loader(get("neu"))).toMatchObject({
        cancelHref: "/overview/new?entwurf=d1",
        values: { email: "", name: "" },
      });
    });

    it("opens a person with the saved values, whichever of the two is missing", async () => {
      expect((await loader(get("p1"))).values).toEqual({
        email: "person.a@example.com",
        name: "",
      });
      expect((await loader(get("p2"))).values).toEqual({ email: "", name: "Person B" });
    });

    it("answers 404 for a person that is not in the draft", async () => {
      await expect(loader(get("nope"))).rejects.toMatchObject({ init: { status: 404 } });
    });
  });

  describe("saving a new person", () => {
    it("adds the person and returns to the form", async () => {
      const response = await action(
        post("neu", { email: " Person.C@Example.com ", name: " Person C " }),
      );

      expect(addDraftParticipant).toHaveBeenCalledWith({ db: true }, "1", "d1", {
        email: "person.c@example.com",
        name: "Person C",
      });
      expect(location(response)).toBe("/overview/new?entwurf=d1");
    });

    it("adds a person who only has a name", async () => {
      await action(post("neu", { email: "", name: "Person C" }));

      expect(addDraftParticipant).toHaveBeenCalledWith({ db: true }, "1", "d1", {
        email: null,
        name: "Person C",
      });
    });

    it("lets several people share an e-mail address or a name", async () => {
      const response = await action(
        post("neu", { email: "person.a@example.com", name: "Person B" }),
      );

      expect(location(response)).toBe("/overview/new?entwurf=d1");
      expect(addDraftParticipant).toHaveBeenCalledOnce();
    });

    it("answers 400 with the problem and what was typed, saving nothing", async () => {
      const response = (await action(
        post("neu", { email: "nope", name: "Person C" }),
      )) as unknown as DataResponse;

      expect(response.init?.status).toBe(400);
      expect(response.data.values).toEqual({ email: "nope", name: "Person C" });
      expect(response.data.errors.email).toBe("Geben Sie eine gültige E-Mail-Adresse an.");
      expect(addDraftParticipant).not.toHaveBeenCalled();
    });

    it("asks for an e-mail address when the form is empty", async () => {
      const response = (await action(post("neu", {}))) as unknown as DataResponse;

      expect(response.init?.status).toBe(400);
      expect(response.data.errors.email).toBe("Geben Sie eine E-Mail-Adresse an.");
    });

    it("refuses a person beyond the maximum", async () => {
      vi.mocked(listParticipants).mockResolvedValue(
        Array.from({ length: MAX_PARTICIPANTS }, (_, index) => ({
          id: `p${index}`,
          email: `person.${index}@example.com`,
          name: null,
        })),
      );

      const response = (await action(
        post("neu", { email: "person.z@example.com" }),
      )) as unknown as DataResponse;

      expect(response.init?.status).toBe(400);
      expect(response.data.errors.email).toBe(
        `Sie können höchstens ${MAX_PARTICIPANTS} Personen angeben.`,
      );
      expect(addDraftParticipant).not.toHaveBeenCalled();
    });

    it("answers 404 when the draft vanished while saving", async () => {
      vi.mocked(addDraftParticipant).mockResolvedValue(false);

      await expect(action(post("neu", { email: "person.c@example.com" }))).rejects.toMatchObject({
        init: { status: 404 },
      });
    });
  });

  describe("saving an existing person", () => {
    it("replaces the person and returns to the form", async () => {
      const response = await action(
        post("p2", { email: "person.b@example.com", name: "Person B" }),
      );

      expect(updateDraftParticipant).toHaveBeenCalledWith({ db: true }, "1", "d1", "p2", {
        email: "person.b@example.com",
        name: "Person B",
      });
      expect(addDraftParticipant).not.toHaveBeenCalled();
      expect(location(response)).toBe("/overview/new?entwurf=d1");
    });

    it("answers 404 for a person that is not in the draft", async () => {
      await expect(action(post("nope", { email: "person.c@example.com" }))).rejects.toMatchObject({
        init: { status: 404 },
      });
      expect(updateDraftParticipant).not.toHaveBeenCalled();
    });
  });
});
