import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FlowPage } from "~/components/shared/FlowPage";

describe("FlowPage", () => {
  it("renders the children", () => {
    render(
      <FlowPage>
        <p>Inhalt</p>
      </FlowPage>,
    );
    expect(screen.getByText("Inhalt")).toBeInTheDocument();
  });

  it("wraps the children in the flow-page band", () => {
    const { container } = render(
      <FlowPage>
        <input className="kern-form-input__input" aria-label="Feld" />
      </FlowPage>,
    );
    expect(container.firstChild).toHaveClass("flow-page");
    expect(container.firstChild).toContainElement(screen.getByLabelText("Feld"));
  });

  it.each(["default", "form", "review"] as const)("applies the %s spacing", (spacing) => {
    const { container } = render(<FlowPage spacing={spacing}>x</FlowPage>);
    expect(container.firstChild).toHaveClass(`flow-page--${spacing}`);
  });

  it("uses the default spacing without a spacing", () => {
    const { container } = render(<FlowPage>x</FlowPage>);
    expect(container.firstChild).toHaveClass("flow-page--default");
  });

  it("centers the children at the default width without a width", () => {
    render(<FlowPage>x</FlowPage>);
    expect(screen.getByText("x")).toHaveClass("page-width", "page-width--default");
  });

  it("centers the children at the given width", () => {
    render(<FlowPage width="wide">x</FlowPage>);
    expect(screen.getByText("x")).toHaveClass("page-width--wide");
  });

  it("follows the band with the report-problem button at the same width", () => {
    const { container } = render(<FlowPage width="wide">x</FlowPage>);
    const button = screen.getByRole("button", { name: "Problem mit dieser Seite melden" });
    const band = container.querySelector(".flow-page")!;
    expect(band).not.toContainElement(button);
    expect(button.closest(".page-width")).toHaveClass("page-width--wide");
  });
});
