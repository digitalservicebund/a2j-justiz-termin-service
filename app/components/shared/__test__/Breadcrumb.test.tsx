import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { Breadcrumb } from "../Breadcrumb";

describe("Breadcrumb", () => {
  it("renders small links under the router's basename and marks the last item as current", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          Component: () => (
            <Breadcrumb
              items={[
                { label: "Startseite", href: "/", icon: "home" },
                { label: "Übersicht", href: "/overview" },
                { label: "Detail" },
              ]}
            />
          ),
        },
      ],
      { basename: "/base", initialEntries: ["/base/"] },
    );
    render(<RouterProvider router={router} />);

    expect(screen.getByRole("link", { name: "Startseite" })).toHaveAttribute("href", "/base");
    const overview = screen.getByRole("link", { name: "Übersicht" });
    expect(overview).toHaveAttribute("href", "/base/overview");
    expect(overview).toHaveClass("kern-link", "kern-link--small");
    expect(screen.getByText("Detail")).toHaveAttribute("aria-current", "page");
  });
});
