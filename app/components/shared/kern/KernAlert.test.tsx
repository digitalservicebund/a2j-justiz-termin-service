import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KernAlert } from "~/components/shared/kern/KernAlert";

describe("KernAlert", () => {
  it("renders the title", () => {
    render(<KernAlert type="info" title="Heads up" />);
    expect(screen.getByText("Heads up")).toBeInTheDocument();
  });

  it("has role='alert'", () => {
    render(<KernAlert type="info" title="Heads up" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it.each([
    ["success", "kern-alert--success"],
    ["error", "kern-alert--danger"],
    ["warning", "kern-alert--warning"],
    ["info", "kern-alert--info"],
  ] as const)("applies correct class for type '%s'", (type, expectedClass) => {
    const { container } = render(<KernAlert type={type} title="Title" />);
    expect(container.firstChild).toHaveClass(expectedClass);
  });

  it("renders the message when provided", () => {
    render(<KernAlert type="success" title="Done" message="It worked." />);
    expect(screen.getByText("It worked.")).toBeInTheDocument();
  });

  it("does not render the message body when message is omitted", () => {
    const { container } = render(<KernAlert type="warning" title="Warning" />);
    expect(container.querySelector(".kern-alert__body")).not.toBeInTheDocument();
  });
});
