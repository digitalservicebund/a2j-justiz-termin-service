import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { KernLinkButton, type KernLinkButtonProps } from "~/components/shared/kern/KernLinkButton";

function renderButton(props: Partial<KernLinkButtonProps> = {}) {
  const Stub = createRoutesStub([
    { path: "/", Component: () => <KernLinkButton to="/target" {...props} /> },
  ]);
  return render(<Stub />);
}

describe("KernLinkButton", () => {
  it("renders a link to the target", () => {
    renderButton({ children: "Go" });
    expect(screen.getByRole("link", { name: "Go" })).toHaveAttribute("href", "/target");
  });

  it("wraps primitive children in kern-label markup", () => {
    const { container } = renderButton({ children: "Go" });
    expect(container.querySelector(".kern-label")).toHaveTextContent("Go");
  });

  it("uses primary style by default", () => {
    renderButton({ children: "Go" });
    expect(screen.getByRole("link")).toHaveClass("kern-btn", "kern-btn--primary");
  });

  it.each([
    ["secondary", "kern-btn--secondary"],
    ["tertiary", "kern-btn--tertiary"],
  ] as const)("applies the class for style '%s'", (style, expected) => {
    renderButton({ style, children: "Go", className: "custom" });
    expect(screen.getByRole("link")).toHaveClass(expected, "custom");
  });
});
