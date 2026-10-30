import { render, screen, within } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { AppShell } from "~/components/shared/AppShell";
import type { AuthUser } from "~/core/domain/user";

const user: AuthUser = {
  id: "1",
  name: "Judge A",
  email: "judge.a@example.com",
  roles: ["richter"],
};

function renderShell(props: Partial<Parameters<typeof AppShell>[0]> = {}) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <AppShell {...props}>Inhalt</AppShell> },
  ]);
  return render(<Stub />);
}

describe("AppShell", () => {
  it("renders the content", () => {
    renderShell();
    expect(screen.getByText("Inhalt")).toBeInTheDocument();
  });

  it("does not show user info or logout when signed out", () => {
    renderShell();
    expect(screen.queryByText("Angemeldet als:")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Abmelden" })).not.toBeInTheDocument();
  });

  it("shows the signed-in user's email and a logout button", () => {
    const { container } = renderShell({ user });
    expect(screen.getByText("Angemeldet als:")).toBeInTheDocument();
    expect(screen.getByText(user.email)).toBeInTheDocument();
    const logout = screen.getByRole("button", { name: "Abmelden" });
    expect(logout).toHaveAttribute("type", "submit");
    const form = logout.closest("form");
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/?index");
    expect(container.querySelector('input[name="intent"]')).toHaveValue("logout");
  });

  it("links to the easy-language and sign-language pages, signed in or not", () => {
    const expected = [
      ["Leichte Sprache", "https://service.justiz.de/leichtesprache"],
      ["Gebärdensprache", "https://service.justiz.de/gebaerdensprache"],
    ];
    for (const props of [{}, { user }]) {
      const { unmount } = renderShell(props);
      const nav = screen.getByRole("navigation", { name: "Sprachangebote" });
      for (const [name, href] of expected) {
        expect(within(nav).getByRole("link", { name })).toHaveAttribute("href", href);
      }
      unmount();
    }
  });

  it("names the service in the footer like in the header", () => {
    const { container } = renderShell();
    const footer = container.querySelector("footer")!;
    expect(within(footer).getByText("Justiz-Services")).toBeInTheDocument();
    expect(within(footer).getByText("Onlinedienste der Justiz")).toBeInTheDocument();
  });

  it("shows the report-problem button by default, signed in or not", () => {
    for (const props of [{}, { user }]) {
      const { unmount } = renderShell(props);
      expect(
        screen.getByRole("button", { name: "Problem mit dieser Seite melden" }),
      ).toHaveAttribute("type", "button");
      unmount();
    }
  });

  it("hides the report-problem button when showReportProblem is false", () => {
    renderShell({ showReportProblem: false });
    expect(
      screen.queryByRole("button", { name: "Problem mit dieser Seite melden" }),
    ).not.toBeInTheDocument();
  });

  it("renders breadcrumbs when provided", () => {
    renderShell({ breadcrumbs: [{ label: "Übersicht" }] });
    expect(screen.getByRole("navigation", { name: "Brotkrumen" })).toBeInTheDocument();
  });
});
