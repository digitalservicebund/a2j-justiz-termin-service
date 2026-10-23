import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KernLabel } from "~/components/shared/kern/KernLabel";

describe("KernLabel", () => {
  it("renders a span without htmlFor", () => {
    const { container } = render(<KernLabel>Text</KernLabel>);
    expect(container.firstChild?.nodeName).toBe("SPAN");
    expect(container.firstChild).toHaveClass("kern-label");
  });

  it("renders a label for the control when htmlFor is given", () => {
    render(
      <>
        <KernLabel htmlFor="field">Name</KernLabel>
        <input id="field" />
      </>,
    );
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("applies the size, subtle and custom classes", () => {
    const { container } = render(
      <KernLabel size="small" subtle className="custom">
        Text
      </KernLabel>,
    );
    expect(container.firstChild).toHaveClass(
      "kern-label",
      "kern-label--small",
      "kern-label--subtle",
      "custom",
    );
  });

  it("adds no modifier classes by default", () => {
    const { container } = render(<KernLabel>Text</KernLabel>);
    expect((container.firstChild as HTMLElement).className).toBe("kern-label");
  });
});
