import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KernFormCheck } from "~/components/shared/kern/KernFormCheck";

describe("KernFormCheck", () => {
  it("renders a labelled checkbox", () => {
    render(<KernFormCheck id="check" type="checkbox" label="Agree" />);
    const input = screen.getByRole("checkbox", { name: "Agree" });
    expect(input).toHaveClass("kern-form-check__checkbox");
  });

  it("renders a labelled radio", () => {
    render(<KernFormCheck id="radio" type="radio" label="Option" />);
    expect(screen.getByRole("radio", { name: "Option" })).toHaveClass("kern-form-check__radio");
  });

  it.each(["checkbox", "radio"] as const)("marks a %s as invalid", (type) => {
    render(<KernFormCheck id="x" type={type} label="Label" invalid />);
    expect(screen.getByRole(type)).toHaveClass(`kern-form-check__${type}--error`);
  });

  it("passes input attributes through", () => {
    render(<KernFormCheck id="x" type="checkbox" label="Label" name="roles" value="a" disabled />);
    const input = screen.getByRole("checkbox");
    expect(input).toHaveAttribute("name", "roles");
    expect(input).toHaveAttribute("value", "a");
    expect(input).toBeDisabled();
  });
});
