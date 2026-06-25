import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "~/components/shared/Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>Content</Card>);
    expect(screen.getByText("Content")).toBeInTheDocument();
  });

  it("applies a custom className", () => {
    const { container } = render(<Card className="my-class">Content</Card>);
    expect(container.firstChild).toHaveClass("my-class");
  });

  it("renders without a custom className", () => {
    const { container } = render(<Card>Content</Card>);
    expect(container.firstChild).toBeInTheDocument();
  });
});
