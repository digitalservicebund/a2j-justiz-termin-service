// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "~/adapters/session/session";
import type { AuthUser } from "~/core/domain/user";

import { action, loader } from "../create-termin";
import { emptySlot, type SlotInput } from "../create-termin.schema";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));

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

function postRequest(aktenzeichen: string, slots: SlotInput[]) {
  const form = new FormData();
  form.set("aktenzeichen", aktenzeichen);
  slots.forEach((row, index) => {
    for (const [field, value] of Object.entries(row)) form.set(`slots.${index}.${field}`, value);
  });
  return new Request("http://localhost/overview/new", { method: "POST", body: form });
}

describe("create-termin route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(judge);
  });

  describe("access control", () => {
    it("requires the richter role to load the page", async () => {
      const forbidden = new Response("Forbidden", { status: 403 });
      vi.mocked(requireRole).mockRejectedValue(forbidden);
      const request = new Request("http://localhost/overview/new");

      await expect(loader({ request })).rejects.toBe(forbidden);
      expect(requireRole).toHaveBeenCalledWith(request, "richter");
    });

    it("returns the signed-in user to the page", async () => {
      const request = new Request("http://localhost/overview/new");
      await expect(loader({ request })).resolves.toEqual({ user: judge });
    });

    it("requires the richter role before reading a submission", async () => {
      const forbidden = new Response("Forbidden", { status: 403 });
      vi.mocked(requireRole).mockRejectedValue(forbidden);
      const request = postRequest("A 1", [slot("5"), slot("6")]);
      const formData = vi.spyOn(request, "formData");

      await expect(action({ request })).rejects.toBe(forbidden);
      expect(requireRole).toHaveBeenCalledWith(request, "richter");
      expect(formData).not.toHaveBeenCalled();
    });
  });

  describe("submitting", () => {
    it("redirects to the overview when everything is valid", async () => {
      const response = await action({ request: postRequest("A 1", [slot("5"), slot("6")]) });

      expect(response).toBeInstanceOf(Response);
      expect((response as Response).status).toBe(302);
      expect((response as Response).headers.get("Location")).toBe("/overview");
    });

    it("answers 400 with the errors and the submitted values when invalid", async () => {
      const rows = [slot("5"), { ...slot("6"), day: "40" }];
      const response = await action({ request: postRequest("", rows) });

      expect(response).not.toBeInstanceOf(Response);
      const { data, init } = response as Extract<typeof response, { data: unknown }>;
      expect(init?.status).toBe(400);
      expect(data.errors.aktenzeichen).toBe("Geben Sie ein Aktenzeichen an.");
      expect(data.errors.rows[1]?.date).toBe("Geben Sie ein gültiges Datum an.");
      expect(data.values.slots).toEqual(rows);
    });

    it("answers 400 for a submission without any fields", async () => {
      const request = new Request("http://localhost/overview/new", {
        method: "POST",
        body: new FormData(),
      });
      const response = (await action({ request })) as Extract<
        Awaited<ReturnType<typeof action>>,
        { data: unknown }
      >;

      expect(response.init?.status).toBe(400);
      expect(response.data.errors.aktenzeichen).toBe("Geben Sie ein Aktenzeichen an.");
      expect(response.data.errors.slots).toBe("Geben Sie mindestens zwei Zeitfenster an.");
    });

    it("answers 400 when only one window is given", async () => {
      const response = (await action({ request: postRequest("A 1", [slot("5")]) })) as Extract<
        Awaited<ReturnType<typeof action>>,
        { data: unknown }
      >;

      expect(response.init?.status).toBe(400);
      expect(response.data.errors.slots).toBe("Geben Sie mindestens zwei Zeitfenster an.");
    });
  });
});
