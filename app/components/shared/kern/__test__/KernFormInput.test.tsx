import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KernFormInput } from "~/components/shared/kern/KernFormInput";

describe("KernFormInput", () => {
  it("labels the input", () => {
    render(<KernFormInput id="field" label="Name" name="name" />);
    expect(screen.getByLabelText("Name")).toHaveAttribute("name", "name");
  });

  it("has no error state without an error", () => {
    const { container } = render(<KernFormInput id="field" label="Name" />);
    const input = screen.getByLabelText("Name");
    expect(input).not.toHaveAttribute("aria-invalid");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(input).not.toHaveClass("kern-form-input__input--error");
    expect(container.firstChild).not.toHaveClass("kern-form-input--error");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows the error and links it to the input", () => {
    const { container } = render(<KernFormInput id="field" label="Name" error="Required" />);
    const input = screen.getByLabelText("Name");
    expect(screen.getByRole("alert")).toHaveTextContent("Required");
    expect(screen.getByRole("alert")).toHaveAttribute("id", "field-error");
    expect(input).toHaveAttribute("aria-describedby", "field-error");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveClass("kern-form-input__input--error");
    expect(container.firstChild).toHaveClass("kern-form-input--error");
  });

  it("marks the input invalid without a message", () => {
    render(<KernFormInput id="field" label="Name" invalid />);
    const input = screen.getByLabelText("Name");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveClass("kern-form-input__input--error");
    expect(input).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("applies width, compact label and class options", () => {
    const { container } = render(
      <KernFormInput
        id="field"
        label="Hour"
        width={2}
        compactLabel
        className="input-class"
        wrapperClassName="wrapper-class"
      />,
    );
    expect(screen.getByLabelText("Hour")).toHaveClass(
      "kern-form-input__input--width-2",
      "input-class",
    );
    expect(container.firstChild).toHaveClass("wrapper-class");
    expect(container.querySelector("label")).toHaveClass("kern-label--small", "kern-label--subtle");
  });
});
