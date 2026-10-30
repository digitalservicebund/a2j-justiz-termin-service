import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

function renderPage(url = "/overview") {
  const Stub = createRoutesStub([
    { path: "/overview", Component: Overview, loader },
    { path: "/overview/:appointmentId/confirm", Component: () => <h1>Bestätigung</h1> },
    { path: "/overview/new", Component: () => <h1>Neu</h1> },
  ]);
  return render(<Stub initialEntries={[url]} />);
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

  it("keeps the table header and shows a message row when there are no appointments", async () => {
    vi.mocked(listAppointments).mockResolvedValue([]);

    renderPage();

    expect(
      await screen.findByRole("cell", { name: "Sie haben keine Terminumfrage." }),
    ).toHaveAttribute("colspan", "3");
    expect(screen.getAllByRole("columnheader")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Terminumfrage erstellen" })).toBeVisible();
  });

  it("shows a different message when the filter matches nothing", async () => {
    vi.mocked(listAppointments).mockResolvedValue([
      { id: "a", aktenzeichen: "574 C 1/26", status: "open", confirmedSlot: null },
    ]);

    renderPage("/overview?filter=draft");

    expect(
      await screen.findByRole("cell", { name: "Keine Terminumfragen für diesen Filter." }),
    ).toBeVisible();
    expect(screen.queryByRole("cell", { name: "574 C 1/26" })).not.toBeInTheDocument();
  });

  it("sorts by status by default", async () => {
    vi.mocked(listAppointments).mockResolvedValue([
      { id: "a", aktenzeichen: "574 C 9/26", status: "cancelled", confirmedSlot: null },
      { id: "b", aktenzeichen: "574 C 2/26", status: "draft", confirmedSlot: null },
    ]);

    renderPage();
    const byStatus = await screen.findAllByRole("cell", { name: /^574 C/ });
    expect(byStatus.map((cell) => cell.textContent)).toEqual(["574 C 2/26", "574 C 9/26"]);
    expect(screen.getByLabelText("Sortieren")).toHaveValue("status");
  });

  it("reads the sort and filter from the URL and shows them in the selects", async () => {
    vi.mocked(listAppointments).mockResolvedValue([
      { id: "a", aktenzeichen: "574 C 10/26", status: "open", confirmedSlot: null },
      { id: "b", aktenzeichen: "574 C 2/26", status: "open", confirmedSlot: null },
      { id: "c", aktenzeichen: "574 C 1/26", status: "draft", confirmedSlot: null },
    ]);

    renderPage("/overview?sort=aktenzeichen&filter=open");

    const cells = await screen.findAllByRole("cell", { name: /^574 C/ });
    expect(cells.map((cell) => cell.textContent)).toEqual(["574 C 2/26", "574 C 10/26"]);
    expect(screen.getByLabelText("Sortieren")).toHaveValue("aktenzeichen");
    expect(screen.getByLabelText("Filter")).toHaveValue("open");
  });

  it("ignores unknown sort and filter values", async () => {
    vi.mocked(listAppointments).mockResolvedValue([
      { id: "a", aktenzeichen: "574 C 1/26", status: "open", confirmedSlot: null },
    ]);

    renderPage("/overview?sort=bogus&filter=bogus");

    expect(await screen.findByRole("cell", { name: "574 C 1/26" })).toBeVisible();
    expect(screen.getByLabelText("Sortieren")).toHaveValue("status");
    expect(screen.getByLabelText("Filter")).toHaveValue("none");
  });

  it("applies a changed select right away", async () => {
    vi.mocked(listAppointments).mockResolvedValue([
      { id: "a", aktenzeichen: "574 C 1/26", status: "open", confirmedSlot: null },
      { id: "b", aktenzeichen: "574 C 2/26", status: "draft", confirmedSlot: null },
    ]);

    renderPage();
    await userEvent.selectOptions(await screen.findByLabelText("Filter"), "draft");

    expect(await screen.findByRole("cell", { name: "574 C 2/26" })).toBeVisible();
    expect(screen.queryByRole("cell", { name: "574 C 1/26" })).not.toBeInTheDocument();
  });

  it("offers the sidebar with only the overview linked", async () => {
    vi.mocked(listAppointments).mockResolvedValue([]);

    renderPage();

    const nav = await screen.findByRole("navigation", { name: "Bereiche" });
    expect(within(nav).getByRole("link", { name: "Übersicht" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      within(nav)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Übersicht", "Abwesenheiten", "Kalender abonnieren", "Einstellungen"]);
    expect(within(nav).getAllByRole("link")).toHaveLength(1);
  });

  it("shows the report-problem button once, inside the content column", async () => {
    vi.mocked(listAppointments).mockResolvedValue([]);

    const { container } = renderPage();

    const button = await screen.findByRole("button", { name: "Problem mit dieser Seite melden" });
    expect(screen.getAllByRole("button", { name: "Problem mit dieser Seite melden" })).toHaveLength(
      1,
    );
    expect(container.querySelector(".overview__content")).toContainElement(button);
  });
});
