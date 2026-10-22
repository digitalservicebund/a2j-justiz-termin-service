import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import type { AuthUser } from "~/core/domain/user";

import OverviewDetail, { loader } from "../overview.detail";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/appointments/appointments.server", () => ({ getAppointment: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const judge: AuthUser = {
  id: "1",
  name: "Muthig",
  email: "muthig@justiz.niedersachsen.de",
  roles: ["richter"],
};

const params = { appointmentId: "a1" };
const request = () => new Request("http://localhost:3000/overview/a1");

// 10:00 and 14:00 Berlin time in summer are 08:00 and 12:00 UTC.
const slots = [
  { start: new Date("2026-09-24T12:00:00Z"), end: new Date("2026-09-24T15:00:00Z") },
  { start: new Date("2026-09-17T08:00:00Z"), end: new Date("2026-09-17T12:00:00Z") },
  { start: new Date("2026-09-24T07:00:00Z"), end: new Date("2026-09-24T09:00:00Z") },
];

describe("overview detail route", () => {
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

  it("answers 404 for an unknown appointment or one of another user", async () => {
    vi.mocked(getAppointment).mockResolvedValue(undefined);

    await expect(loader({ request: request(), params })).rejects.toMatchObject({
      init: { status: 404 },
    });
    expect(getAppointment).toHaveBeenCalledWith({ db: true }, "1", "a1");
  });

  it("answers 404 for states that have no detail page yet", async () => {
    for (const status of ["open", "confirmed"] as const) {
      vi.mocked(getAppointment).mockResolvedValue({
        id: "a1",
        status,
        aktenzeichen: "A 1",
        slots,
      });

      await expect(loader({ request: request(), params })).rejects.toMatchObject({
        init: { status: 404 },
      });
    }
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

  it("returns the Aktenzeichen and the windows per day for a cancelled appointment", async () => {
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "cancelled",
      aktenzeichen: "574 C 65412/26",
      slots,
    });

    const result = await loader({ request: request(), params });

    expect(result.aktenzeichen).toBe("574 C 65412/26");
    expect(result.days).toEqual([
      { key: "2026-09-17", label: "17. September 2026", times: ["10:00 bis 14:00"] },
      {
        key: "2026-09-24",
        label: "24. September 2026",
        times: ["09:00 bis 11:00", "14:00 bis 17:00"],
      },
    ]);
  });
});

describe("OverviewDetail", () => {
  it("explains that no slot fits and offers a new Terminumfrage", async () => {
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(getAppointment).mockResolvedValue({
      id: "a1",
      status: "cancelled",
      aktenzeichen: "574 C 65412/26",
      slots,
    });
    const Stub = createRoutesStub([
      { path: "/overview/:appointmentId", Component: OverviewDetail, loader },
      { path: "/overview", Component: () => <h1>Übersicht</h1> },
      { path: "/overview/new", Component: () => <h1>Neu</h1> },
    ]);

    render(<Stub initialEntries={["/overview/a1"]} />);

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Es gibt leider keine Terminoption, bei der alle Verfahrensbeteiligten Zeit haben.",
      }),
    ).toBeVisible();
    expect(screen.getByText("Kein Zeitfenster passt")).toBeVisible();
    expect(screen.getByRole("link", { name: "Zurück zu den Terminumfragen" })).toHaveAttribute(
      "href",
      "/overview",
    );
    expect(screen.getByRole("link", { name: "Terminumfrage erstellen" })).toHaveAttribute(
      "href",
      "/overview/new",
    );
    expect(screen.getByRole("heading", { name: "Verhandlungsdaten" })).toBeVisible();
    expect(screen.getByText("Aktenzeichen")).toBeVisible();
    expect(screen.getAllByText("574 C 65412/26").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Zeitfenster" })).toBeVisible();
    expect(screen.getByText("17. September 2026")).toBeVisible();
    expect(screen.getByText("09:00 bis 11:00")).toBeVisible();
    expect(screen.getByText("14:00 bis 17:00")).toBeVisible();
  });
});
