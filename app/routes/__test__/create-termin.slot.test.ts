// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addDraftSlot,
  getAppointment,
  updateDraftSlot,
} from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import type { AuthUser } from "~/core/domain/user";

import { MAX_SLOTS } from "../create-termin.schema";
import { action, loader } from "../create-termin.slot";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/appointments/appointments.server", () => ({
  addDraftSlot: vi.fn(),
  getAppointment: vi.fn(),
  updateDraftSlot: vi.fn(),
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

const draft = (slots = [stored("5"), stored("6")], status: "draft" | "open" = "draft") => ({
  id: "d1",
  status,
  aktenzeichen: "A 1",
  slots,
});

const fields = (day: string, overrides: Record<string, string> = {}) => ({
  day,
  month: "1",
  year: "2099",
  startHour: "11",
  startMinute: "0",
  endHour: "12",
  endMinute: "30",
  ...overrides,
});

const url = (slotId: string, query = "") =>
  `http://localhost/overview/d1/zeitfenster/${slotId}${query}`;

const post = (slotId: string, body: Record<string, string>) => ({
  request: new Request(url(slotId), { method: "POST", body: new URLSearchParams(body) }),
  params: { appointmentId: "d1", slotId },
});

const get = (slotId: string, query = "") => ({
  request: new Request(url(slotId, query)),
  params: { appointmentId: "d1", slotId },
});

type DataResponse = { data: Record<string, any>; init: { status?: number } | null };
const location = (response: unknown) => (response as Response).headers.get("Location");

describe("create-termin slot route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(getAppointment).mockResolvedValue(draft());
    vi.mocked(addDraftSlot).mockResolvedValue(true);
    vi.mocked(updateDraftSlot).mockResolvedValue(true);
  });

  describe("access control", () => {
    it("requires the richter role to load and to submit", async () => {
      const forbidden = new Response("Forbidden", { status: 403 });
      vi.mocked(requireRole).mockRejectedValue(forbidden);

      await expect(loader(get("neu"))).rejects.toBe(forbidden);
      const submission = post("neu", fields("7"));
      const formData = vi.spyOn(submission.request, "formData");
      await expect(action(submission)).rejects.toBe(forbidden);
      expect(formData).not.toHaveBeenCalled();
      expect(addDraftSlot).not.toHaveBeenCalled();
    });

    it("answers 404 for a draft that does not exist or is someone else's", async () => {
      vi.mocked(getAppointment).mockResolvedValue(undefined);

      await expect(loader(get("neu"))).rejects.toMatchObject({ init: { status: 404 } });
      await expect(action(post("neu", fields("7")))).rejects.toMatchObject({
        init: { status: 404 },
      });
      expect(addDraftSlot).not.toHaveBeenCalled();
    });

    it("leaves a published appointment alone", async () => {
      vi.mocked(getAppointment).mockResolvedValue(draft([stored("5")], "open"));

      await expect(loader(get("neu"))).rejects.toMatchObject({ status: 302 });
      await expect(action(post("neu", fields("7")))).rejects.toMatchObject({ status: 302 });
      expect(addDraftSlot).not.toHaveBeenCalled();
    });
  });

  describe("loading", () => {
    it("starts a new slot empty and links back to the form", async () => {
      const result = await loader(get("neu"));

      expect(result).toMatchObject({
        isNew: true,
        cancelHref: "/overview/new?entwurf=d1",
        values: { day: "", month: "", year: "", startHour: "", endMinute: "" },
      });
    });

    it("starts a copy with the values of the slot it copies", async () => {
      const result = await loader(get("neu", "?kopie=s6"));

      expect(result.isNew).toBe(true);
      expect(result.values).toEqual({
        day: "06",
        month: "01",
        year: "2099",
        startHour: "09",
        startMinute: "00",
        endHour: "10",
        endMinute: "00",
      });
    });

    it("starts empty when the slot to copy does not exist", async () => {
      const result = await loader(get("neu", "?kopie=nope"));
      expect(result.values.day).toBe("");
    });

    it("opens an existing slot with its values", async () => {
      const result = await loader(get("s5"));

      expect(result.isNew).toBe(false);
      expect(result.values.day).toBe("05");
    });

    it("answers 404 for a slot that is not in the draft", async () => {
      await expect(loader(get("nope"))).rejects.toMatchObject({ init: { status: 404 } });
    });
  });

  describe("saving a new slot", () => {
    it("adds it and returns to the form", async () => {
      const response = await action(post("neu", fields("7")));

      expect(addDraftSlot).toHaveBeenCalledWith({ db: true }, "1", "d1", {
        start: new Date("2099-01-07T10:00:00Z"),
        end: new Date("2099-01-07T11:30:00Z"),
      });
      expect(location(response)).toBe("/overview/new?entwurf=d1");
    });

    it("answers 400 with the problems and the typed values, saving nothing", async () => {
      const typed = fields("40", { endHour: "9" });
      const response = (await action(post("neu", typed))) as unknown as DataResponse;

      expect(response.init?.status).toBe(400);
      expect(response.data.values).toEqual(typed);
      expect(response.data.errors.date).toBe("Geben Sie ein gültiges Datum an.");
      expect(response.data.errors.range).toBe("Die Endzeit muss nach der Startzeit liegen.");
      expect(addDraftSlot).not.toHaveBeenCalled();
    });

    it("answers 400 for an empty form", async () => {
      const response = (await action(post("neu", {}))) as unknown as DataResponse;

      expect(response.init?.status).toBe(400);
      expect(Object.keys(response.data.errors)).toEqual(
        expect.arrayContaining(["date", "start", "end"]),
      );
    });

    it("names the slot it overlaps with, by date and time", async () => {
      const response = (await action(
        post(
          "neu",
          fields("5", { startHour: "9", startMinute: "30", endHour: "10", endMinute: "30" }),
        ),
      )) as unknown as DataResponse;

      expect(response.init?.status).toBe(400);
      expect(response.data.errors.overlap).toBe(
        "Dieses Zeitfenster überschneidet sich mit dem Zeitfenster am 5. Januar 2099, 09:00 bis 10:00.",
      );
      expect(addDraftSlot).not.toHaveBeenCalled();
    });

    it("lets a slot start when another one ends", async () => {
      const response = await action(
        post("neu", fields("5", { startHour: "10", startMinute: "0", endHour: "11" })),
      );

      expect(location(response)).toBe("/overview/new?entwurf=d1");
    });

    it("refuses a slot beyond the maximum", async () => {
      vi.mocked(getAppointment).mockResolvedValue(
        draft(Array.from({ length: MAX_SLOTS }, (_, index) => stored(String(index + 1)))),
      );

      const response = (await action(post("neu", fields("30")))) as unknown as DataResponse;

      expect(response.init?.status).toBe(400);
      expect(response.data.errors.overlap).toBe(`Geben Sie höchstens ${MAX_SLOTS} Zeitfenster an.`);
      expect(addDraftSlot).not.toHaveBeenCalled();
    });

    it("answers 404 when the draft vanished while saving", async () => {
      vi.mocked(addDraftSlot).mockResolvedValue(false);

      await expect(action(post("neu", fields("7")))).rejects.toMatchObject({
        init: { status: 404 },
      });
    });
  });

  describe("saving an existing slot", () => {
    it("replaces the slot and returns to the form", async () => {
      const response = await action(post("s5", fields("8")));

      expect(updateDraftSlot).toHaveBeenCalledWith({ db: true }, "1", "d1", "s5", {
        start: new Date("2099-01-08T10:00:00Z"),
        end: new Date("2099-01-08T11:30:00Z"),
      });
      expect(addDraftSlot).not.toHaveBeenCalled();
      expect(location(response)).toBe("/overview/new?entwurf=d1");
    });

    it("does not overlap with itself", async () => {
      const response = await action(post("s5", fields("5", { startHour: "9", endHour: "10" })));

      expect(location(response)).toBe("/overview/new?entwurf=d1");
    });

    it("still overlaps with the other slots", async () => {
      const response = (await action(
        post("s5", fields("6", { startHour: "9", endHour: "10" })),
      )) as unknown as DataResponse;

      expect(response.init?.status).toBe(400);
      expect(response.data.errors.overlap).toContain("6. Januar 2099");
    });

    it("answers 404 for a slot that is not in the draft", async () => {
      await expect(action(post("nope", fields("8")))).rejects.toMatchObject({
        init: { status: 404 },
      });
      expect(updateDraftSlot).not.toHaveBeenCalled();
    });
  });
});
