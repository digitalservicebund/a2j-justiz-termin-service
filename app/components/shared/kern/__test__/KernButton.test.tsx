import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KernButton } from "~/components/shared/kern/KernButton";

describe("KernButton", () => {
  it("renders children", () => {
    render(<KernButton>Click me</KernButton>);
    expect(screen.getByRole("button", { name: "Click me" })).toBeInTheDocument();
  });

  it("wraps primitive children in kern-label markup", () => {
    const { container } = render(<KernButton>Click</KernButton>);
    expect(container.querySelector(".kern-label")).toHaveTextContent("Click");
  });

  it("always includes the base kern-btn class", () => {
    const { container } = render(<KernButton>Click</KernButton>);
    expect(container.firstChild).toHaveClass("kern-btn");
  });

  it("uses primary style by default", () => {
    const { container } = render(<KernButton>Click</KernButton>);
    expect(container.firstChild).toHaveClass("kern-btn--primary");
  });

  it.each([
    ["primary", "kern-btn--primary"],
    ["secondary", "kern-btn--secondary"],
    ["tertiary", "kern-btn--tertiary"],
  ] as const)("applies correct class for style '%s'", (style, expectedClass) => {
    const { container } = render(<KernButton style={style}>Click</KernButton>);
    expect(container.firstChild).toHaveClass(expectedClass);
  });

  it("merges a custom className", () => {
    const { container } = render(<KernButton className="my-class">Click</KernButton>);
    expect(container.firstChild).toHaveClass("kern-btn", "kern-btn--primary", "my-class");
  });

  it("passes through the disabled prop", () => {
    render(<KernButton disabled>Click</KernButton>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("passes through the type prop", () => {
    render(<KernButton type="submit">Submit</KernButton>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});
