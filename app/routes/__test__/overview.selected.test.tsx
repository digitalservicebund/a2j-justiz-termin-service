import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import type { AuthUser } from "~/core/domain/user";

import OverviewSelected, { loader } from "../overview.selected";

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
const request = () => new Request("http://localhost:3000/overview/a1/selected");

// 15:30 Berlin time in November is 14:30 UTC; Monday 9 November 2026.
const confirmed = {
  id: "a1",
  status: "confirmed" as const,
  aktenzeichen: "574 C 65412/26",
  slots: [
    { id: "s1", start: new Date("2026-11-09T14:30:00Z"), end: new Date("2026-11-09T17:00:00Z") },
  ],
  confirmedSlot: {
    start: new Date("2026-11-09T14:30:00Z"),
    end: new Date("2026-11-09T17:00:00Z"),
  },
};

describe("overview selected route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(getAppointment).mockResolvedValue(confirmed);
  });

  it("requires the richter role", async () => {
    const forbidden = new Response("Forbidden", { status: 403 });
    vi.mocked(requireRole).mockRejectedValue(forbidden);

    await expect(loader({ request: request(), params })).rejects.toBe(forbidden);
    expect(getAppointment).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown appointment or one of another user", async () => {
    vi.mocked(getAppointment).mockResolvedValue(undefined);

    await expect(loader({ request: request(), params })).rejects.toMatchObject({
      init: { status: 404 },
    });
    expect(getAppointment).toHaveBeenCalledWith({ db: true }, "1", "a1");
  });

  it("returns the Aktenzeichen and the confirmed start", async () => {
    expect(await loader({ request: request(), params })).toMatchObject({
      aktenzeichen: "574 C 65412/26",
      termin: expect.stringMatching(/^\p{L}+, 9\. November 2026 um 15:30$/u),
    });
  });

  it.each([
    { status: "open" as const },
    { status: "draft" as const },
    { status: "confirmed" as const, confirmedSlot: null },
  ])(
    "sends an appointment without a confirmed Termin ($status) to its detail page",
    async (patch) => {
      vi.mocked(getAppointment).mockResolvedValue({ ...confirmed, ...patch });

      const thrown = await loader({ request: request(), params }).catch((error: Response) => error);

      expect(thrown).toBeInstanceOf(Response);
      expect((thrown as Response).headers.get("Location")).toBe("/overview/a1");
    },
  );
});

describe("OverviewSelected", () => {
  it("announces the Termin and lists the next steps", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(getAppointment).mockResolvedValue(confirmed);
    const Stub = createRoutesStub([
      { path: "/overview/:appointmentId/selected", Component: OverviewSelected, loader },
      { path: "/overview", Component: () => <h1>Übersicht</h1> },
    ]);

    render(<Stub initialEntries={["/overview/a1/selected"]} />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: /^Der Termin ist am \p{L}+, 9\. November 2026 um 15:30\.$/u,
      }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: /Zu den Terminumfragen/ })).toHaveAttribute(
      "href",
      "/overview",
    );
    expect(screen.getByRole("link", { name: /Nächste Schritte/ })).toHaveAttribute(
      "href",
      "#naechste-schritte",
    );
    expect(
      screen.getByRole("heading", {
        name: "Informieren Sie alle Verfahrensbeteiligten und Ihre Servicestelle über den Termin.",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Ihre Servicestelle verschickt die Ladung." }),
    ).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Termindetails kopieren" }));

    expect(writeText).toHaveBeenCalledWith(
      expect.stringMatching(
        /^Aktenzeichen: 574 C 65412\/26\nTermin: \p{L}+, 9\. November 2026 um 15:30$/u,
      ),
    );
    expect(await screen.findByRole("button", { name: "Termindetails kopiert" })).toBeVisible();
  });
});
