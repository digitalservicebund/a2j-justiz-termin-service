import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KernHeading } from "~/components/shared/kern/KernHeading";

describe("KernHeading", () => {
  it("renders a heading of the given level", () => {
    render(
      <KernHeading size="large" level={2}>
        Title
      </KernHeading>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Title" })).toBeInTheDocument();
  });

  it("renders a paragraph without a level", () => {
    const { container } = render(<KernHeading size="medium">Title</KernHeading>);
    expect(container.firstChild?.nodeName).toBe("P");
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
  });

  it.each([
    ["x-large", "kern-heading-x-large"],
    ["large", "kern-heading-large"],
    ["medium", "kern-heading-medium"],
    ["small", "kern-heading-small"],
    ["title", "kern-title"],
    ["title-small", "kern-title kern-title--small"],
  ] as const)("applies the classes for size '%s'", (size, expected) => {
    const { container } = render(<KernHeading size={size}>x</KernHeading>);
    expect(container.firstChild).toHaveClass(...expected.split(" "));
  });

  it("passes className and attributes through", () => {
    render(
      <KernHeading size="small" level={1} id="heading" className="custom">
        Title
      </KernHeading>,
    );
    const heading = screen.getByRole("heading");
    expect(heading).toHaveAttribute("id", "heading");
    expect(heading).toHaveClass("custom");
  });
});
