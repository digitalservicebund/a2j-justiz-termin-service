import { render, screen } from "@testing-library/react";
import { createMemoryRouter, Link, RouterProvider } from "react-router";
import { describe, expect, it } from "vitest";

import { KernIcon } from "~/components/shared/kern/KernIcon";
import { KernLink, type KernLinkProps } from "~/components/shared/kern/KernLink";

function renderLink(props: Partial<KernLinkProps> = {}) {
  return render(<KernLink href="/target" {...props} />);
}

describe("KernLink", () => {
  it("renders a link to the target", () => {
    renderLink({ children: "Go" });
    expect(screen.getByRole("link", { name: "Go" })).toHaveAttribute("href", "/target");
  });

  it("uses the default size without a size modifier", () => {
    renderLink({ children: "Go" });
    const link = screen.getByRole("link");
    expect(link).toHaveClass("kern-link");
    expect(link).not.toHaveClass("kern-link--small");
  });

  it("applies the small modifier and keeps custom classes", () => {
    renderLink({ size: "small", children: "Go", className: "custom" });
    expect(screen.getByRole("link")).toHaveClass("kern-link", "kern-link--small", "custom");
  });

  it("applies the no-visited-state modifier only when noVisitedState is set", () => {
    const { unmount } = renderLink({ children: "Go" });
    expect(screen.getByRole("link")).not.toHaveClass("kern-link--no-visited-state");
    unmount();

    renderLink({ noVisitedState: true, children: "Go" });
    expect(screen.getByRole("link")).toHaveClass("kern-link", "kern-link--no-visited-state");
  });

  it("renders an icon before or after the text", () => {
    renderLink({
      children: (
        <>
          <KernIcon name="arrow-forward" />
          Go
        </>
      ),
    });
    const link = screen.getByRole("link", { name: "Go" });
    expect(link.firstElementChild).toHaveClass("kern-icon--arrow-forward");
  });

  it("renders the given component instead of an anchor, e.g. the router Link", () => {
    const router = createMemoryRouter(
      [
        {
          path: "/",
          Component: () => (
            <KernLink as={Link} to="/overview" size="small">
              Go
            </KernLink>
          ),
        },
      ],
      { basename: "/base", initialEntries: ["/base/"] },
    );
    render(<RouterProvider router={router} />);
    const link = screen.getByRole("link", { name: "Go" });
    expect(link).toHaveAttribute("href", "/base/overview");
    expect(link).toHaveClass("kern-link", "kern-link--small");
  });
});
