import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "~/components/shared/Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(
      screen.getByRole("button", { name: "Click me" }),
    ).toBeInTheDocument();
  });

  it("always includes the base kern-btn class", () => {
    const { container } = render(<Button>Click</Button>);
    expect(container.firstChild).toHaveClass("kern-btn");
  });

  it("uses primary style by default", () => {
    const { container } = render(<Button>Click</Button>);
    expect(container.firstChild).toHaveClass("kern-btn--primary");
  });

  it.each([
    ["primary", "kern-btn--primary"],
    ["secondary", "kern-btn--secondary"],
    ["tertiary", "kern-btn--tertiary"],
  ] as const)(
    "applies correct class for style '%s'",
    (style, expectedClass) => {
      const { container } = render(<Button style={style}>Click</Button>);
      expect(container.firstChild).toHaveClass(expectedClass);
    },
  );

  it("merges a custom className", () => {
    const { container } = render(<Button className="my-class">Click</Button>);
    expect(container.firstChild).toHaveClass(
      "kern-btn",
      "kern-btn--primary",
      "my-class",
    );
  });

  it("passes through the disabled prop", () => {
    render(<Button disabled>Click</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });

  it("passes through the type prop", () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });
});
