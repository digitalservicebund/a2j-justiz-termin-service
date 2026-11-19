import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KernFieldset } from "~/components/shared/kern/KernFieldset";

describe("KernFieldset", () => {
  it("renders a group named by its legend", () => {
    render(
      <KernFieldset id="group" legend="Options">
        <input type="checkbox" />
      </KernFieldset>,
    );
    expect(screen.getByRole("group", { name: "Options" })).toHaveClass("kern-fieldset");
    expect(screen.getByRole("checkbox")).toBeInTheDocument();
  });

  it("has no error state without an error", () => {
    render(<KernFieldset id="group" legend="Options" />);
    const group = screen.getByRole("group");
    expect(group).not.toHaveClass("kern-fieldset--error");
    expect(group).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the error and links it to the group", () => {
    render(<KernFieldset id="group" legend="Options" error="Choose one" />);
    const group = screen.getByRole("group");
    expect(group).toHaveClass("kern-fieldset--error");
    expect(group).toHaveAttribute("aria-describedby", "group-error");
    expect(screen.getByRole("alert")).toHaveTextContent("Choose one");
    expect(screen.getByRole("alert")).toHaveAttribute("id", "group-error");
  });

  it("hides the legend visually but keeps it for screen readers", () => {
    render(<KernFieldset id="group" legend="Options" hideLegend />);
    expect(screen.getByText("Options")).toHaveClass("kern-sr-only");
    expect(screen.getByRole("group", { name: "Options" })).toBeInTheDocument();
  });

  it("applies custom classes to the fieldset and its body", () => {
    const { container } = render(
      <KernFieldset id="group" legend="Options" className="custom" bodyClassName="body-custom" />,
    );
    expect(screen.getByRole("group")).toHaveClass("custom");
    expect(container.querySelector(".kern-fieldset__body")).toHaveClass("body-custom");
  });
});
