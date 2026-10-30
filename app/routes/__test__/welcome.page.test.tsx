import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getSessionUser } from "~/adapters/session/session";

import Welcome, { loader } from "../welcome";

vi.mock("~/adapters/session/session", () => ({ getSessionUser: vi.fn() }));
vi.mock("~/adapters/users/users.server", () => ({ canSignIn: vi.fn() }));
vi.mock("~/database/database", () => ({ getDb: () => ({}) }));
vi.mock("~/lib/auth.server", () => ({ getAuth: () => ({ handler: vi.fn() }) }));
vi.mock("~/lib/logging", () => ({ logError: vi.fn() }));

async function renderPage(url = "/") {
  const Stub = createRoutesStub([{ path: "/", Component: Welcome, loader }]);
  render(<Stub initialEntries={[url]} />);
  await screen.findByRole("heading", { level: 1, name: "Verhandlungstermin-Finder" });
}

const user = { id: "user-a", name: "Person A", email: "person.a@example.com", roles: ["klaeger"] };

describe("Welcome", () => {
  beforeEach(() => {
    vi.mocked(getSessionUser).mockResolvedValue(null);
  });

  it("shows the login form and the breadcrumb without an Übersicht crumb", async () => {
    await renderPage();
    expect(screen.getByLabelText("E‑Mail-Adresse")).toBeInTheDocument();
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

  it("invites visitors to take part in the research, in an information notice", async () => {
    await renderPage();
    const title = screen.getByText("Gestalten Sie die digitalen Angebote der Justiz mit");
    const notice = title.closest(".a2j-inline-notice")!;
    expect(notice).toHaveClass("a2j-inline-notice--information");
    expect(
      within(notice as HTMLElement).getByRole("link", { name: "Jetzt für die Teilnahme anmelden" }),
    ).toBeInTheDocument();
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

  describe("for a signed-in user", () => {
    beforeEach(() => {
      vi.mocked(getSessionUser).mockResolvedValue(user as never);
    });

    it("shows a button to the overview instead of the login form", async () => {
      await renderPage();
      const main = screen.getByRole("main");
      const breadcrumb = within(main).getByRole("navigation", { name: "Brotkrumen" });
      const button = within(main)
        .getAllByRole("link", { name: "Verhandlungstermin-Finder" })
        .find((link) => !breadcrumb.contains(link));
      expect(button).toHaveClass("kern-btn", "kern-btn--primary");
      expect(button).toHaveAttribute("href", "/overview");
      expect(screen.queryByLabelText("E‑Mail-Adresse")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Anmelden" })).not.toBeInTheDocument();
    });

    it("shows who is signed in with a logout button", async () => {
      await renderPage();
      expect(screen.getByText("person.a@example.com")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Abmelden" })).toBeInTheDocument();
    });

    it("shows the same breadcrumb as for guests", async () => {
      await renderPage();
      const breadcrumb = screen.getByRole("navigation", { name: "Brotkrumen" });
      expect(
        within(breadcrumb)
          .getAllByRole("listitem")
          .map((item) => item.textContent),
      ).toEqual(["", "Verhandlungstermin-Finder"]);
      expect(within(breadcrumb).getByRole("link", { name: "Startseite" })).toHaveAttribute(
        "href",
        "https://service.justiz.de/",
      );
    });

    it("keeps the process steps and the pilot notice", async () => {
      await renderPage();
      expect(screen.getByRole("heading", { name: "Der Ablauf" })).toBeInTheDocument();
      expect(
        screen.getByText("Der Onlinedienst befindet sich in der Testphase (Pilotprojekt)"),
      ).toBeInTheDocument();
    });

    it("does not show the invalid-link alert", async () => {
      await renderPage("/?error=INVALID_TOKEN");
      expect(screen.queryByText("Ungültiger Anmeldelink")).not.toBeInTheDocument();
    });
  });
});
