import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { FieldColumn, FormActions, FormStack } from "~/components/shared/FormLayout";

function renderInRouter(element: React.ReactElement) {
  const Stub = createRoutesStub([{ path: "/", Component: () => element }]);
  return render(<Stub />);
}

describe("FieldColumn", () => {
  it.each(["small", "medium", "large"] as const)("caps the width of a %s field", (size) => {
    render(
      <FieldColumn size={size}>
        <input aria-label="Feld" />
      </FieldColumn>,
    );
    const column = screen.getByLabelText("Feld").parentElement;
    expect(column).toHaveClass("field-column", `field-column--${size}`);
  });
});

describe("FormStack", () => {
  it("stacks the sections of the form with the large gap by default", () => {
    renderInRouter(<FormStack method="post" aria-label="Formular" />);
    const form = screen.getByRole("form", { name: "Formular" });
    expect(form).toHaveClass("kern-flex", "kern-flex-col", "kern-gap-xl");
    expect(form).toHaveAttribute("method", "post");
  });

  it("takes another gap and keeps a className passed in", () => {
    renderInRouter(<FormStack method="post" gap="md" className="extra" aria-label="Formular" />);
    expect(screen.getByRole("form", { name: "Formular" })).toHaveClass("kern-gap-md", "extra");
  });
});

describe("FormActions", () => {
  it("lays the buttons side by side, set apart from the fields", () => {
    render(
      <FormActions>
        <button type="button">Zurück</button>
        <button type="submit">Weiter</button>
      </FormActions>,
    );
    const actions = screen.getByRole("button", { name: "Weiter" }).parentElement;
    expect(actions).toHaveClass("kern-flex", "kern-flex-wrap", "kern-gap-md", "kern-pt-md");
    expect(actions).toContainElement(screen.getByRole("button", { name: "Zurück" }));
  });
});
