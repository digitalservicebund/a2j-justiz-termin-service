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

  it("adds the given class name", () => {
    const { container } = render(<FlowPage className="custom">x</FlowPage>);
    expect(container.firstChild).toHaveClass("flow-page", "custom");
  });

  it("centers the children at the default width without a width", () => {
    render(<FlowPage>x</FlowPage>);
    expect(screen.getByText("x")).toHaveClass("page-width", "page-width--default");
  });

  it("centers the children at the given width", () => {
    render(<FlowPage width="wide">x</FlowPage>);
    expect(screen.getByText("x")).toHaveClass("page-width--wide");
  });
});
