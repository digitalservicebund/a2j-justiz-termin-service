import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { requireRole } from "~/adapters/session/session";
import { deleteSitzungstag, listSitzungstage } from "~/adapters/users/sitzungstage.server";

import Settings, { action, loader } from "./settings";

vi.mock("~/adapters/session/session", () => ({ requireRole: vi.fn() }));
vi.mock("~/adapters/users/sitzungstage.server", () => ({
  listSitzungstage: vi.fn(),
  deleteSitzungstag: vi.fn(),
}));
vi.mock("~/database/database", () => ({ getDb: () => ({ db: true }) }));

const renderPage = () => {
  const Stub = createRoutesStub([
    { path: "/einstellungen", Component: Settings, loader, action },
    { path: "/einstellungen/sitzungstage/:id", Component: () => <h1>Sitzungstag</h1> },
  ]);
  render(<Stub initialEntries={["/einstellungen"]} />);
};

describe("Settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireRole).mockResolvedValue({
      id: "j1",
      name: "Judge A",
      email: "judge.a@example.com",
      roles: ["richter"],
    });
    vi.mocked(listSitzungstage).mockResolvedValue([
      { id: "s1", weekday: 2, start: 10 * 60, end: 17 * 60 },
      { id: "s2", weekday: 4, start: 9 * 60, end: 16 * 60 },
    ]);
    vi.mocked(deleteSitzungstag).mockResolvedValue(true);
  });

  it("shows the Sitzungstage in a table with their times", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", {
        level: 1,
        name: "Sitzungstage und reguläre Verhandlungszeiten",
      }),
    ).toBeVisible();
    const table = screen.getByRole("table", {
      name: "Sitzungstage und reguläre Verhandlungszeiten",
    });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Wochentag", "Reguläre Verhandlungszeiten", "Aktionen"]);
    const rows = within(table).getAllByRole("row").slice(1);
    expect(
      rows.map((row) =>
        within(row)
          .getAllByRole("cell")
          .slice(0, 2)
          .map((cell) => cell.textContent),
      ),
    ).toEqual([
      ["Dienstag", "10:00 bis 17:00"],
      ["Donnerstag", "09:00 bis 16:00"],
    ]);
  });

  it("links each row to its form and the add button to a new one", async () => {
    renderPage();

    expect(
      await screen.findByRole("link", {
        name: "Sitzungstag Dienstag, 10:00 bis 17:00 bearbeiten",
      }),
    ).toHaveAttribute("href", "/einstellungen/sitzungstage/s1");
    expect(screen.getByRole("link", { name: "Sitzungstag hinzufügen" })).toHaveAttribute(
      "href",
      "/einstellungen/sitzungstage/neu",
    );
  });

  it("deletes a row with its button", async () => {
    renderPage();

    await userEvent.click(
      await screen.findByRole("button", {
        name: "Sitzungstag Donnerstag, 09:00 bis 16:00 löschen",
      }),
    );

    await vi.waitFor(() =>
      expect(deleteSitzungstag).toHaveBeenCalledWith({ db: true }, "j1", "s2"),
    );
  });

  it("says so when there are no Sitzungstage, and still offers to add one", async () => {
    vi.mocked(listSitzungstage).mockResolvedValue([]);
    renderPage();

    expect(
      await screen.findByRole("cell", { name: "Sie haben keine Sitzungstage hinzugefügt." }),
    ).toBeVisible();
    expect(screen.queryByRole("button", { name: /löschen/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sitzungstag hinzufügen" })).toBeVisible();
  });

  it("marks the settings as the current page of the navigation", async () => {
    renderPage();

    const nav = await screen.findByRole("navigation", { name: "Bereiche" });
    expect(within(nav).getByRole("link", { name: "Einstellungen" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});
