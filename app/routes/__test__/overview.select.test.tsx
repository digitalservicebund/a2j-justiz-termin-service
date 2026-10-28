import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAppointment } from "~/adapters/appointments/appointments.server";
import { requireRole } from "~/adapters/session/session";
import type { AuthUser } from "~/core/domain/user";

import OverviewSelect, { action, loader } from "../overview.select";

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
const url = "http://localhost:3000/overview/a1/select";

// 15:30 to 18:00 and 09:00 to 13:00 Berlin time in September are 13:30 to 16:00 and 07:00 to 11:00 UTC.
const open = {
  id: "a1",
  status: "open" as const,
  aktenzeichen: "574 C 65412/26",
  slots: [
    { id: "s1", start: new Date("2026-09-17T13:30:00Z"), end: new Date("2026-09-17T16:00:00Z") },
    { id: "s2", start: new Date("2026-09-21T07:00:00Z"), end: new Date("2026-09-21T11:00:00Z") },
  ],
};

function postRequest(fields: Record<string, string>) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new Request(url, { method: "POST", body: form });
}

describe("overview select route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue(judge);
    vi.mocked(getAppointment).mockResolvedValue(open);
  });

  it("requires the richter role to load and to submit", async () => {
    const forbidden = new Response("Forbidden", { status: 403 });
    vi.mocked(requireRole).mockRejectedValue(forbidden);

    await expect(loader({ request: new Request(url), params })).rejects.toBe(forbidden);
    await expect(action({ request: postRequest({}), params })).rejects.toBe(forbidden);
    expect(getAppointment).not.toHaveBeenCalled();
  });

  it("answers 404 for an unknown appointment or one of another user", async () => {
    vi.mocked(getAppointment).mockResolvedValue(undefined);

    await expect(loader({ request: new Request(url), params })).rejects.toMatchObject({
      init: { status: 404 },
    });
    await expect(action({ request: postRequest({}), params })).rejects.toMatchObject({
      init: { status: 404 },
    });
    expect(getAppointment).toHaveBeenCalledWith({ db: true }, "1", "a1");
  });

  it.each(["draft", "confirmed", "cancelled"] as const)(
    "sends a %s appointment back to its detail page",
    async (status) => {
      vi.mocked(getAppointment).mockResolvedValue({ ...open, status });

      for (const run of [
        () => loader({ request: new Request(url), params }),
        () => action({ request: postRequest({ fenster: "0", stunde: "16", minute: "0" }), params }),
      ]) {
        const thrown = await run().catch((error: Response) => error);
        expect(thrown).toBeInstanceOf(Response);
        expect((thrown as Response).headers.get("Location")).toBe("/overview/a1");
      }
    },
  );

  it("lists the windows and brings an earlier choice along", async () => {
    const result = await loader({
      request: new Request(`${url}?fenster=1&stunde=10&minute=15`),
      params,
    });

    expect(result).toMatchObject({
      aktenzeichen: "574 C 65412/26",
      windows: ["17. September 2026 von 15:30 bis 18:00", "21. September 2026 von 09:00 bis 13:00"],
      values: { slot: "1", hour: "10", minute: "15" },
    });
  });

  it("continues to the review with a valid choice", async () => {
    const response = (await action({
      request: postRequest({ fenster: "0", stunde: "16", minute: "30" }),
      params,
    })) as Response;

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toBe(
      "/overview/a1/select/confirm?fenster=0&stunde=16&minute=30",
    );
  });

  it("answers 400 with the entered values when the start lies outside the window", async () => {
    const response = (await action({
      request: postRequest({ fenster: "0", stunde: "19", minute: "0" }),
      params,
    })) as { init: { status: number }; data: unknown };

    expect(response.init.status).toBe(400);
    expect(response.data).toEqual({
      values: { slot: "0", hour: "19", minute: "0" },
      errors: { start: "Die Startzeit muss zwischen 15:30 und 18:00 liegen." },
    });
  });
});

function renderPage(initialEntry = "/overview/a1/select") {
  vi.mocked(requireRole).mockResolvedValue(judge);
  vi.mocked(getAppointment).mockResolvedValue(open);
  const Stub = createRoutesStub([
    { path: "/overview/:appointmentId/select", Component: OverviewSelect, loader, action },
    { path: "/overview/:appointmentId/select/confirm", Component: () => <h1>Prüfen</h1> },
    { path: "/overview", Component: () => <h1>Übersicht</h1> },
  ]);
  render(<Stub initialEntries={[initialEntry]} />);
}

describe("OverviewSelect", () => {
  it("shows the Aktenzeichen, the windows and the start time fields", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Wählen Sie ein Datum und eine Startzeit aus",
      }),
    ).toBeVisible();
    expect(screen.getByText("574 C 65412/26")).toBeVisible();
    expect(screen.getByRole("group", { name: "Zeitfenster" })).toBeVisible();
    expect(
      screen.getByRole("radio", { name: "17. September 2026 von 15:30 bis 18:00" }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("radio", { name: "21. September 2026 von 09:00 bis 13:00" }),
    ).toBeVisible();
    expect(screen.getByRole("group", { name: "Startzeit" })).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Stunde" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Minute" })).toHaveValue("");
    expect(screen.getByRole("link", { name: "Abbrechen" })).toHaveAttribute("href", "/overview");
  });

  it("restores an earlier choice", async () => {
    renderPage("/overview/a1/select?fenster=1&stunde=10&minute=15");

    expect(
      await screen.findByRole("radio", { name: "21. September 2026 von 09:00 bis 13:00" }),
    ).toBeChecked();
    expect(screen.getByRole("textbox", { name: "Stunde" })).toHaveValue("10");
    expect(screen.getByRole("textbox", { name: "Minute" })).toHaveValue("15");
  });

  it("asks for a window and a start time when nothing is entered", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: "Weiter" }));

    expect(await screen.findByText("Wählen Sie ein Zeitfenster aus.")).toBeVisible();
    expect(screen.queryByText("Prüfen")).not.toBeInTheDocument();
  });

  it("explains that the start has to lie within the chosen window", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("radio", { name: "17. September 2026 von 15:30 bis 18:00" }),
    );
    await user.type(screen.getByRole("textbox", { name: "Stunde" }), "19");
    await user.type(screen.getByRole("textbox", { name: "Minute" }), "00");
    await user.click(screen.getByRole("button", { name: "Weiter" }));

    expect(
      await screen.findByText("Die Startzeit muss zwischen 15:30 und 18:00 liegen."),
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Stunde" })).toBeInvalid();
    expect(screen.getByRole("textbox", { name: "Stunde" })).toHaveValue("19");
  });

  it("continues to the review with a valid choice", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(
      await screen.findByRole("radio", { name: "17. September 2026 von 15:30 bis 18:00" }),
    );
    await user.type(screen.getByRole("textbox", { name: "Stunde" }), "16");
    await user.type(screen.getByRole("textbox", { name: "Minute" }), "00");
    await user.click(screen.getByRole("button", { name: "Weiter" }));

    expect(await screen.findByRole("heading", { name: "Prüfen" })).toBeVisible();
  });
});
