import { render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { describe, expect, it, vi } from "vitest";

import { Breadcrumb, type BreadcrumbItem } from "../Breadcrumb";

function renderBreadcrumb(items?: BreadcrumbItem[], basename = "/base") {
  const router = createMemoryRouter(
    [{ path: "/", Component: () => <Breadcrumb items={items} /> }],
    {
      basename,
      initialEntries: [`${basename}/`],
    },
  );
  render(<RouterProvider router={router} />);
}

describe("Breadcrumb", () => {
  it("always starts with the icon link to the service home, outside the app's base path", () => {
    renderBreadcrumb();

    const home = screen.getByRole("link", { name: "Startseite" });
    expect(home).toHaveAttribute("href", "https://service.justiz.de/");
    expect(home).toHaveClass("kern-link");
    expect(home).not.toHaveClass("kern-link--small");
  });

  it("marks the Verhandlungstermin-Finder as current when there are no further items", () => {
    renderBreadcrumb();

    expect(screen.getByText("Verhandlungstermin-Finder")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByRole("link", { name: "Verhandlungstermin-Finder" })).toBeNull();
  });

  it("links the Verhandlungstermin-Finder under the router's basename and marks the last item as current", () => {
    renderBreadcrumb([{ label: "Übersicht", href: "/overview" }, { label: "Detail" }]);

    const finder = screen.getByRole("link", { name: "Verhandlungstermin-Finder" });
    expect(finder).toHaveAttribute("href", "/base");
    expect(finder).toHaveClass("kern-link", "kern-link--small");
    expect(screen.getByRole("link", { name: "Übersicht" })).toHaveAttribute(
      "href",
      "/base/overview",
    );
    expect(screen.getByText("Detail")).toHaveAttribute("aria-current", "page");
  });

  it("renders items that share a label without key collisions", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    renderBreadcrumb([{ label: "Dienst", href: "/overview" }, { label: "Dienst" }]);

    expect(screen.getAllByText("Dienst")).toHaveLength(2);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
