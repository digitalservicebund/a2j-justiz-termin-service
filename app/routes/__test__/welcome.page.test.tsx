import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it, vi } from "vitest";

import Welcome, { loader } from "../welcome";

vi.mock("~/adapters/session/session", () => ({ getSessionUser: vi.fn().mockResolvedValue(null) }));
vi.mock("~/adapters/users/users.server", () => ({ canSignIn: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({}) }));
vi.mock("~/lib/auth.server", () => ({ getAuth: () => ({ handler: vi.fn() }) }));
vi.mock("~/lib/logging", () => ({ logError: vi.fn() }));

async function renderPage(url = "/") {
  const Stub = createRoutesStub([{ path: "/", Component: Welcome, loader }]);
  render(<Stub initialEntries={[url]} />);
  await screen.findByRole("heading", { level: 1, name: "Verhandlungstermin-Finder" });
}

describe("Welcome", () => {
  it("shows the login form and the breadcrumb without an Übersicht crumb", async () => {
    await renderPage();
    expect(screen.getByLabelText("E-Mail-Adresse")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Anmelden" })).toBeInTheDocument();
    const breadcrumb = screen.getByRole("navigation", { name: "Brotkrumen" });
    expect(within(breadcrumb).getByText("Verhandlungstermin-Finder")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(breadcrumb).queryByText("Übersicht")).not.toBeInTheDocument();
  });

  it("collapses the pilot notice by default and describes the invitation-only pilot", async () => {
    await renderPage();
    const summary = screen.getByText(
      "Der Onlinedienst befindet sich in der Testphase (Pilotprojekt)",
    );
    const details = summary.closest("details");
    expect(details).not.toHaveAttribute("open");
    expect(details).toHaveTextContent(
      "Verfahrensbeteiligte können den Onlinedienst aktuell nur auf Einladung nutzen.",
    );
  });

  it("lists the four steps in order", async () => {
    await renderPage();
    const section = screen.getByRole("heading", { name: "Der Ablauf" }).closest("section")!;
    const steps = within(section).getAllByRole("listitem");
    expect(steps.map((step) => step.textContent)).toEqual([
      "Das Gericht erstellt die Terminumfrage",
      "Verfahrensbeteiligte teilen ihre Verfügbarkeit",
      "Das Gericht wählt einen passenden Termin aus",
      "Die Servicestelle verschickt die Ladung",
    ]);
  });

  it("has no feedback box", async () => {
    await renderPage();
    expect(screen.queryByText("Hat Ihnen diese Seite geholfen?")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ja" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Nein" })).not.toBeInTheDocument();
  });

  it("shows an alert for an invalid sign-in link", async () => {
    await renderPage("/?error=INVALID_TOKEN");
    expect(screen.getByText("Ungültiger Anmeldelink")).toBeInTheDocument();
  });
});
