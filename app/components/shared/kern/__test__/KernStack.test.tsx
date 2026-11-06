import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KernStack } from "~/components/shared/kern/KernStack";

describe("KernStack", () => {
  it("renders the children one below the other", () => {
    render(
      <KernStack data-testid="stack">
        <p>Eins</p>
        <p>Zwei</p>
      </KernStack>,
    );
    const stack = screen.getByTestId("stack");
    expect(stack.tagName).toBe("DIV");
    expect(stack).toHaveClass("kern-flex", "kern-flex-col");
    expect(stack).toHaveTextContent("EinsZwei");
  });

  it("adds no gap or alignment without props", () => {
    render(<KernStack data-testid="stack" />);
    expect(screen.getByTestId("stack").className).not.toMatch(/kern-gap|kern-align/);
  });

  it("maps gap and align to KERN's helper classes", () => {
    render(<KernStack data-testid="stack" gap="lg" align="start" />);
    expect(screen.getByTestId("stack")).toHaveClass("kern-gap-lg", "kern-align-items-start");
  });

  it("keeps a className passed in", () => {
    render(<KernStack data-testid="stack" className="extra" />);
    expect(screen.getByTestId("stack")).toHaveClass("kern-flex", "extra");
  });

  it.each(["ul", "ol", "fieldset"] as const)("resets the browser styles of a %s", (as) => {
    render(<KernStack as={as} data-testid="stack" />);
    const stack = screen.getByTestId("stack");
    expect(stack.tagName).toBe(as.toUpperCase());
    expect(stack).toHaveClass("kern-m-none", "kern-p-none", "layout-reset");
  });

  it("leaves other elements alone", () => {
    render(<KernStack as="section" data-testid="stack" />);
    expect(screen.getByTestId("stack")).not.toHaveClass("layout-reset");
  });
});
