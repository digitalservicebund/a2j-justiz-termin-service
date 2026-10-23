import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listAppointments } from "~/adapters/appointments/appointments.server";

import Overview, { loader } from "../overview";

vi.mock("~/adapters/appointments/appointments.server", () => ({ listAppointments: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));
vi.mock("~/adapters/session/session", () => ({
  requireUser: vi.fn().mockResolvedValue({
    id: "u1",
    name: "Judge A",
    email: "judge.a@example.com",
    roles: ["richter"],
  }),
}));

function renderPage() {
  const Stub = createRoutesStub([
    { path: "/overview", Component: Overview, loader },
    { path: "/overview/:appointmentId/confirm", Component: () => <h1>Bestätigung</h1> },
    { path: "/overview/new", Component: () => <h1>Neu</h1> },
  ]);
  return render(<Stub initialEntries={["/overview"]} />);
}

const slot = { start: new Date("2099-11-09T14:30:00Z"), end: new Date("2099-11-09T15:30:00Z") };

describe("Overview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lists the user's appointments with their status, in the given order", async () => {
    vi.mocked(listAppointments).mockResolvedValue([
      { id: "a", aktenzeichen: "574 C 1/26", status: "draft", confirmedSlot: null },
      { id: "b", aktenzeichen: "574 C 2/26", status: "open", confirmedSlot: null },
      { id: "c", aktenzeichen: "574 C 3/26", status: "confirmed", confirmedSlot: slot },
      { id: "d", aktenzeichen: "574 C 4/26", status: "cancelled", confirmedSlot: null },
    ]);

    renderPage();

    const rows = (await screen.findAllByRole("row")).slice(1);
    const cells = rows.map((row) =>
      within(row)
        .getAllByRole("cell")
        .slice(0, 2)
        .map((cell) => cell.textContent),
    );
    expect(cells).toEqual([
      ["574 C 1/26", "Entwurf"],
      ["574 C 2/26", "Offen für Rückmeldungen"],
      ["574 C 3/26", expect.stringMatching(/^Termin ist \p{L}+, 9\. November 2099 um 15:30$/u)],
      ["574 C 4/26", "Kein Zeitfenster passt"],
    ]);
    expect(listAppointments).toHaveBeenCalledWith({ db: true }, "u1");
  });

  it("links drafts to their confirmation page and all other states to their detail page", async () => {
    vi.mocked(listAppointments).mockResolvedValue([
      { id: "a", aktenzeichen: "574 C 1/26", status: "draft", confirmedSlot: null },
      { id: "b", aktenzeichen: "574 C 2/26", status: "open", confirmedSlot: null },
      { id: "c", aktenzeichen: "574 C 3/26", status: "cancelled", confirmedSlot: null },
      { id: "d", aktenzeichen: "574 C 4/26", status: "confirmed", confirmedSlot: slot },
    ]);

    renderPage();

    const links = await screen.findAllByRole("link", { name: /öffnen$/ });
    const hrefs = Object.fromEntries(
      links.map((link) => [link.textContent, link.getAttribute("href")]),
    );
    expect(hrefs).toEqual({
      "Terminumfrage 574 C 1/26 öffnen": "/overview/a/confirm",
      "Terminumfrage 574 C 2/26 öffnen": "/overview/b",
      "Terminumfrage 574 C 3/26 öffnen": "/overview/c",
      "Terminumfrage 574 C 4/26 öffnen": "/overview/d",
    });
  });

  it("renders a striped table with an action column and one open button per row", async () => {
    vi.mocked(listAppointments).mockResolvedValue([
      { id: "a", aktenzeichen: "574 C 1/26", status: "open", confirmedSlot: null },
    ]);

    renderPage();

    const table = await screen.findByRole("table", { name: "Terminumfragen" });
    expect(table).toHaveClass("kern-table--striped");
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((header) => header.textContent),
    ).toEqual(["Aktenzeichen", "Status", "Aktionen"]);
    const row = within(table).getByRole("cell", { name: "574 C 1/26" }).closest("tr")!;
    expect(within(row).getByRole("link", { name: "Terminumfrage 574 C 1/26 öffnen" })).toHaveClass(
      "kern-btn--secondary",
      "kern-btn--x-small",
    );
    // The Aktenzeichen itself is plain text, the button is the only way in.
    expect(within(row).getAllByRole("link")).toHaveLength(1);
  });

  it("shows a message instead of an empty table when there are no appointments", async () => {
    vi.mocked(listAppointments).mockResolvedValue([]);

    renderPage();

    expect(await screen.findByText("Sie haben noch keine Terminumfragen erstellt.")).toBeVisible();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Terminumfrage erstellen" })).toBeVisible();
  });
});
