import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KernBody } from "~/components/shared/kern/KernBody";

describe("KernBody", () => {
  it("renders a paragraph with the base class by default", () => {
    const { container } = render(<KernBody>Text</KernBody>);
    expect(container.firstChild?.nodeName).toBe("P");
    expect((container.firstChild as HTMLElement).className).toBe("kern-body");
  });

  it("renders a span when asked to", () => {
    const { container } = render(<KernBody as="span">Text</KernBody>);
    expect(container.firstChild?.nodeName).toBe("SPAN");
  });

  it.each([
    ["small", "kern-body--small"],
    ["large", "kern-body--large"],
  ] as const)("applies the class for size '%s'", (size, expected) => {
    const { container } = render(<KernBody size={size}>x</KernBody>);
    expect(container.firstChild).toHaveClass(expected);
  });

  it("combines bold, muted and custom classes", () => {
    const { container } = render(
      <KernBody size="large" bold muted className="custom" id="body">
        x
      </KernBody>,
    );
    expect(container.firstChild).toHaveClass(
      "kern-body--large",
      "kern-body--bold",
      "kern-body--muted",
      "custom",
    );
    expect(container.firstChild).toHaveAttribute("id", "body");
  });
});
