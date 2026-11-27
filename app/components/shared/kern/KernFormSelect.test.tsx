import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { KernFormSelect } from "~/components/shared/kern/KernFormSelect";

describe("KernFormSelect", () => {
  it("labels the select and lists its options", () => {
    render(
      <KernFormSelect id="sort" label="Sortieren" name="sort" defaultValue="b">
        <option value="a">A</option>
        <option value="b">B</option>
      </KernFormSelect>,
    );
    const select = screen.getByLabelText("Sortieren");
    expect(select).toHaveAttribute("name", "sort");
    expect(select).toHaveClass("kern-form-input__select");
    expect(select).toHaveValue("b");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["A", "B"]);
  });

  it("describes the select by its hint and its error, and marks it invalid", () => {
    render(
      <KernFormSelect id="court" label="Gericht" hint="Ein Hinweis" error="Ein Fehler">
        <option value="">–</option>
      </KernFormSelect>,
    );
    const select = screen.getByRole("combobox", { name: "Gericht" });
    expect(select).toHaveAccessibleDescription("Ein Hinweis Ein Fehler");
    expect(select).toHaveAttribute("aria-invalid", "true");
    expect(select).toHaveClass("kern-form-input__select--error");
  });

  it("is valid without an error", () => {
    render(
      <KernFormSelect id="court" label="Gericht">
        <option value="">–</option>
      </KernFormSelect>,
    );
    const select = screen.getByRole("combobox", { name: "Gericht" });
    expect(select).not.toHaveAttribute("aria-invalid");
    expect(select).not.toHaveAttribute("aria-describedby");
  });

  it("reports changes and wraps the select in the KERN select wrapper", async () => {
    const onChange = vi.fn();
    const { container } = render(
      <KernFormSelect id="sort" label="Sortieren" onChange={onChange} wrapperClassName="custom">
        <option value="a">A</option>
        <option value="b">B</option>
      </KernFormSelect>,
    );
    await userEvent.selectOptions(screen.getByLabelText("Sortieren"), "b");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(container.firstChild).toHaveClass("kern-form-input", "custom");
    expect(container.querySelector(".kern-form-input__select-wrapper select")).not.toBeNull();
  });
});
