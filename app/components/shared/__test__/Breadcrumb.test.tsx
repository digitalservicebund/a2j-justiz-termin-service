import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Breadcrumb } from "../Breadcrumb";

describe("Breadcrumb", () => {
  it("renders small links for the parents and marks the last item as current", () => {
    render(
      <Breadcrumb
        items={[
          { label: "Startseite", href: "/", icon: "home" },
          { label: "Übersicht", href: "/overview" },
          { label: "Detail" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: "Startseite" })).toHaveAttribute("href", "/");
    const overview = screen.getByRole("link", { name: "Übersicht" });
    expect(overview).toHaveAttribute("href", "/overview");
    expect(overview).toHaveClass("kern-link", "kern-link--small");
    expect(screen.getByText("Detail")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Detail" })).not.toBeInTheDocument();
  });
});
