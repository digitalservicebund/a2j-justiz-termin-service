import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Badge } from "~/components/shared/Badge";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge type="info">Label</Badge>);
    expect(screen.getByText("Label")).toBeInTheDocument();
  });

  it.each([
    ["success", "kern-badge--success"],
    ["info", "kern-badge--info"],
    ["warning", "kern-badge--warning"],
    ["danger", "kern-badge--danger"],
  ] as const)("applies correct class for type '%s'", (type, expectedClass) => {
    const { container } = render(<Badge type={type}>x</Badge>);
    expect(container.firstChild).toHaveClass(expectedClass);
  });
});
