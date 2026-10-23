import { render, screen } from "@testing-library/react";
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
    expect(container.querySelector('input[name="intent"]')).toHaveValue("logout");
  });

  it("renders breadcrumbs when provided", () => {
    renderShell({ breadcrumbs: [{ label: "Startseite", href: "/" }, { label: "Übersicht" }] });
    expect(screen.getByRole("navigation", { name: "Brotkrumen" })).toBeInTheDocument();
  });
});
