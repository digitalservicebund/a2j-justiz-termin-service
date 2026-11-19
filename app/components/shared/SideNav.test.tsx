import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { SideNav } from "~/components/shared/SideNav";

function renderNav() {
  const Stub = createRoutesStub([
    {
      path: "/",
      Component: () => (
        <SideNav
          label="Hauptnavigation"
          items={[
            {
              label: "Übersicht",
              icon: <span data-testid="icon" />,
              to: "/overview",
              current: true,
            },
            { label: "Verlinkt", icon: null, to: "/other" },
            { label: "Ohne Ziel", icon: null },
          ]}
        />
      ),
    },
  ]);
  return render(<Stub />);
}

describe("SideNav", () => {
  it("is a named navigation landmark with one list item per entry", async () => {
    renderNav();
    expect(await screen.findByRole("navigation", { name: "Hauptnavigation" })).toBeVisible();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("links entries with a destination and marks the current page", async () => {
    renderNav();
    const current = await screen.findByRole("link", { name: "Übersicht" });
    expect(current).toHaveAttribute("href", "/overview");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Verlinkt" })).not.toHaveAttribute("aria-current");
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("shows entries without a destination as plain text, not as a link", async () => {
    renderNav();
    expect(await screen.findByText("Ohne Ziel")).toBeVisible();
    expect(screen.queryByRole("link", { name: "Ohne Ziel" })).not.toBeInTheDocument();
  });
});
