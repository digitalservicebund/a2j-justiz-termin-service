import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { confirmAppointment, getAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import type { AuthUser } from "~/core/domain/user";

import OverviewSelectConfirm, { action, loader } from "../overview.select.confirm";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/appointments/appointments.server", () => ({
  getAppointment: vi.fn(),
  confirmAppointment: vi.fn(),
}));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const judge: AuthUser = {
  id: "1",
  name: "Muthig",
  email: "muthig@justiz.niedersachsen.de",
  roles: ["richter"],
};

const params = { appointmentId: "a1" };
const url = "http://localhost:3000/overview/a1/select/confirm";
const query = "?fenster=0&stunde=16&minute=30";

// 15:30 to 18:00 Berlin time in November is 14:30 to 17:00 UTC; Monday 9 November 2026.
const open = {
  id: "a1",
  status: "open" as const,
  aktenzeichen: "574 C 65412/26",
  slots: [{ start: new Date("2026-11-09T14:30:00Z"), end: new Date("2026-11-09T17:00:00Z") }],
};

const locationOf = (response: unknown) => (response as Response).headers.get("Location");

function postRequest(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new Request(url, { method: "POST", body: form });
}

const choice = { fenster: "0", stunde: "16", minute: "30" };

describe("overview select confirm route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(getAppointment).mockResolvedValue(open);
    vi.mocked(confirmAppointment).mockResolvedValue(true);
  });

  it("requires the richter role to load and to submit", async () => {
    const forbidden = new Response("Forbidden", { status: 403 });
    vi.mocked(requireRole).mockRejectedValue(forbidden);

    await expect(loader({ request: new Request(url + query), params })).rejects.toBe(forbidden);
    await expect(
      action({ request: postRequest({ intent: "confirm", ...choice }), params }),
    ).rejects.toBe(forbidden);
    expect(getAppointment).not.toHaveBeenCalled();
    expect(confirmAppointment).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown appointment or one of another user", async () => {
    vi.mocked(getAppointment).mockResolvedValue(undefined);

    await expect(loader({ request: new Request(url + query), params })).rejects.toMatchObject({
      init: { status: 404 },
    });
    await expect(
      action({ request: postRequest({ intent: "confirm", ...choice }), params }),
    ).rejects.toMatchObject({ init: { status: 404 } });
    expect(confirmAppointment).not.toHaveBeenCalled();
  });

  it("names the chosen start for review", async () => {
    const result = await loader({ request: new Request(url + query), params });

    expect(result).toMatchObject({
      aktenzeichen: "574 C 65412/26",
      values: { slot: "0", hour: "16", minute: "30" },
      termin: expect.stringMatching(/^\p{L}+, 9\. November 2026 um 16:30$/u),
    });
  });

  it("sends an appointment that is not open to its detail page", async () => {
    vi.mocked(getAppointment).mockResolvedValue({ ...open, status: "confirmed" });

    const thrown = await loader({ request: new Request(url + query), params }).catch(
      (error: Response) => error,
    );

    expect(locationOf(thrown)).toBe("/overview/a1");
  });

  it("sends the judge back to the choice when the query is missing or out of bounds", async () => {
    for (const search of ["", "?fenster=0&stunde=18&minute=0", "?fenster=3&stunde=16&minute=0"]) {
      const thrown = await loader({ request: new Request(url + search), params }).catch(
        (error: Response) => error,
      );
      expect(thrown).toBeInstanceOf(Response);
      expect(locationOf(thrown)).toMatch(/^\/overview\/a1\/select\?fenster=/);
    }
  });

  it("goes back to the choice and keeps it", async () => {
    const response = await action({
      request: postRequest({ intent: "back", ...choice }),
      params,
    });

    expect(locationOf(response)).toBe("/overview/a1/select?fenster=0&stunde=16&minute=30");
    expect(confirmAppointment).not.toHaveBeenCalled();
  });

  it("confirms the window from the chosen start to the end of the slot", async () => {
    const response = await action({
      request: postRequest({ intent: "confirm", ...choice }),
      params,
    });

    expect(confirmAppointment).toHaveBeenCalledWith({ db: true }, "1", "a1", {
      start: new Date("2026-11-09T15:30:00Z"),
      end: new Date("2026-11-09T17:00:00Z"),
    });
    expect(locationOf(response)).toBe("/overview/a1/selected");
  });

  it("does not confirm a start outside the window", async () => {
    const response = await action({
      request: postRequest({ intent: "confirm", fenster: "0", stunde: "14", minute: "0" }),
      params,
    });

    expect(confirmAppointment).not.toHaveBeenCalled();
    expect(locationOf(response)).toBe("/overview/a1/select?fenster=0&stunde=14&minute=0");
  });

  it("shows the detail page when the appointment was confirmed in the meantime", async () => {
    vi.mocked(confirmAppointment).mockResolvedValue(false);

    const response = await action({
      request: postRequest({ intent: "confirm", ...choice }),
      params,
    });

    expect(locationOf(response)).toBe("/overview/a1");
  });

  it("rejects an unknown intent", async () => {
    for (const fields of [{ intent: "delete", ...choice }, choice]) {
      await expect(action({ request: postRequest(fields), params })).rejects.toMatchObject({
        init: { status: 400 },
      });
    }
    expect(confirmAppointment).not.toHaveBeenCalled();
  });
});

function renderPage() {
  vi.mocked(requireRole).mockResolvedValue(judge);
  vi.mocked(getAppointment).mockResolvedValue(open);
  vi.mocked(confirmAppointment).mockResolvedValue(true);
  const Stub = createRoutesStub([
    {
      path: "/overview/:appointmentId/select/confirm",
      Component: OverviewSelectConfirm,
      loader,
      action,
    },
    { path: "/overview/:appointmentId/select", Component: () => <h1>Auswahl</h1> },
    { path: "/overview/:appointmentId/selected", Component: () => <h1>Bestätigt</h1> },
  ]);
  render(<Stub initialEntries={[`/overview/a1/select/confirm${query}`]} />);
}

describe("OverviewSelectConfirm", () => {
  it("summarizes the Aktenzeichen and the chosen Termin", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { level: 1, name: "Bitte überprüfen Sie Ihre Angaben" }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: "Verhandlungsdaten" })).toBeVisible();
    expect(screen.getByText("574 C 65412/26", { selector: "dd" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Ausgewählter Termin" })).toBeVisible();
    expect(screen.getByText(/^\p{L}+, 9\. November 2026 um 16:30$/u)).toBeVisible();
    // Only the Termin can be edited, the Verhandlungsdaten belong to the survey.
    expect(screen.getAllByRole("button", { name: /^Bearbeiten/ })).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Bearbeiten Ausgewählter Termin" })).toBeVisible();
  });

  it("hides and shows all sections", async () => {
    const user = userEvent.setup();
    renderPage();
    const termin = await screen.findByText(/um 16:30$/);

    await user.click(screen.getByRole("button", { name: "Alle ausblenden" }));
    expect(termin).not.toBeVisible();

    await user.click(screen.getByRole("button", { name: "Alle einblenden" }));
    expect(termin).toBeVisible();
  });

  it("goes back to the choice from Zurück", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Zurück" }));
    expect(await screen.findByRole("heading", { name: "Auswahl" })).toBeVisible();
  });

  it("confirms the Termin and shows the result", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Termin bestätigen" }));

    expect(await screen.findByRole("heading", { name: "Bestätigt" })).toBeVisible();
    expect(confirmAppointment).toHaveBeenCalledTimes(1);
  });
});
