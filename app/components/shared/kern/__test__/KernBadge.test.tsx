import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KernBadge } from "~/components/shared/kern/KernBadge";

describe("KernBadge", () => {
  it("renders children", () => {
    render(<KernBadge type="info">Label</KernBadge>);
    expect(screen.getByText("Label")).toBeInTheDocument();
  });

  it("wraps primitive children in kern-label markup", () => {
    const { container } = render(<KernBadge type="info">Label</KernBadge>);
    expect(container.querySelector(".kern-label")).toHaveTextContent("Label");
  });

  it.each([
    ["custom-grey", "kern-badge--custom-grey"],
    ["success", "kern-badge--success"],
    ["info", "kern-badge--info"],
    ["warning", "kern-badge--warning"],
    ["danger", "kern-badge--danger"],
  ] as const)("applies correct class for type '%s'", (type, expectedClass) => {
    const { container } = render(<KernBadge type={type}>x</KernBadge>);
    expect(container.firstChild).toHaveClass(expectedClass);
  });
});
