import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { SidebarPage } from "~/components/shared/SidebarPage";
import type { AuthUser, UserRole } from "~/core/domain/user";

const userWith = (roles: UserRole[]): AuthUser => ({
  id: "u1",
  name: "Person A",
  email: "person.a@example.com",
  roles,
});

function renderPage(props: Partial<Parameters<typeof SidebarPage>[0]> = {}) {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <SidebarPage current="overview" user={userWith(["richter"])} {...props}>
          <p>Inhalt</p>
        </SidebarPage>
      ),
    },
  ]);
  return render(<Stub />);
}

describe("SidebarPage", () => {
  it("shows the main navigation and the content", async () => {
    renderPage();
    expect(await screen.findByRole("navigation", { name: "Bereiche" })).toBeVisible();
    expect(screen.getByText("Inhalt")).toBeVisible();
  });

  it("marks the current page of the navigation", async () => {
    renderPage({ current: "calendar" });
    const link = await screen.findByRole("link", { name: "Kalender abonnieren" });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Übersicht" })).not.toHaveAttribute("aria-current");
  });

  it("links the settings for a judge and an admin, and marks them as the current page", async () => {
    for (const roles of [["richter"], ["admin"]] satisfies UserRole[][]) {
      const { unmount } = renderPage({ current: "settings", user: userWith(roles) });
      const link = await screen.findByRole("link", { name: "Einstellungen" });
      expect(link).toHaveAttribute("href", "/einstellungen");
      expect(link).toHaveAttribute("aria-current", "page");
      unmount();
    }
  });

  it("leaves the settings out for parties of a proceeding", async () => {
    for (const roles of [["klaeger"], ["beklagter"]] satisfies UserRole[][]) {
      const { unmount } = renderPage({ user: userWith(roles) });
      await screen.findByRole("navigation", { name: "Bereiche" });
      expect(screen.queryByText("Einstellungen")).not.toBeInTheDocument();
      unmount();
    }
  });

  it("puts the navigation in 3 of 12 columns and the content next to it in 9", async () => {
    renderPage();
    const nav = (await screen.findByRole("navigation", { name: "Bereiche" })).closest(
      ".kern-grid-col",
    );
    expect(nav).toHaveClass("kern-col-12", "kern-col-lg-3");
    const main = screen.getByText("Inhalt").closest(".kern-col-lg-9");
    expect(main).toBeInTheDocument();
    expect(main).not.toContainElement(nav as HTMLElement);
  });

  it("spaces the navigation from the content when they stack", async () => {
    const { container } = renderPage();
    await screen.findByText("Inhalt");
    expect(container.querySelector(".sidebar-page > .kern-row")).toHaveClass("kern-gap-y-xl");
  });

  it("ends the content with the report-problem button, once, at the width of the content", async () => {
    renderPage();
    const button = await screen.findByRole("button", { name: "Problem mit dieser Seite melden" });
    expect(screen.getAllByRole("button", { name: "Problem mit dieser Seite melden" })).toHaveLength(
      1,
    );
    const content = button.closest(".kern-grid-col")!;
    expect(content).toHaveClass("kern-col-xl-10");
    expect(content).toContainElement(screen.getByText("Inhalt"));
  });

  it("leaves the default space below without a spacing", async () => {
    const { container } = renderPage();
    await screen.findByText("Inhalt");
    expect(container.querySelector(".sidebar-page")).toHaveClass("sidebar-page--default");
  });

  it("lays a form on the grey band of a flow page", async () => {
    const { container } = renderPage({ tone: "form" });
    await screen.findByText("Inhalt");
    expect(container.querySelector(".sidebar-page__band")).toContainElement(
      screen.getByText("Inhalt"),
    );
  });

  it("has no grey band by default", async () => {
    const { container } = renderPage();
    await screen.findByText("Inhalt");
    expect(container.querySelector(".sidebar-page__band")).not.toBeInTheDocument();
  });

  it("leaves more space below on request", async () => {
    const { container } = renderPage({ spacing: "roomy" });
    await screen.findByText("Inhalt");
    expect(container.querySelector(".sidebar-page")).toHaveClass("sidebar-page--roomy");
  });
});
