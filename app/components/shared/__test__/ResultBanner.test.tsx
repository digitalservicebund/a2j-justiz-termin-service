import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ResultBanner } from "~/components/shared/ResultBanner";

describe("ResultBanner", () => {
  it("renders the title as the page heading", () => {
    render(<ResultBanner type="success" title="Erledigt" />);
    expect(screen.getByRole("heading", { level: 1, name: "Erledigt" })).toBeInTheDocument();
  });

  it.each(["success", "info", "warning", "danger"] as const)("styles the %s banner", (type) => {
    const { container } = render(<ResultBanner type={type} title="Titel" />);
    expect(container.querySelector(".kern-alert")).toHaveClass(`kern-alert--${type}`);
  });

  it("renders the message and actions when given", () => {
    render(
      <ResultBanner
        type="danger"
        title="Titel"
        message="Hinweis"
        actions={<button>Weiter</button>}
      />,
    );
    expect(screen.getByText("Hinweis")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weiter" })).toBeInTheDocument();
  });

  it("leaves out the message and actions when not given", () => {
    const { container } = render(<ResultBanner type="success" title="Titel" />);
    expect(container.querySelector(".result-banner__actions")).toBeNull();
    expect(container.querySelector(".kern-body")).toBeNull();
  });

  it("renders without the wide page section when inline", () => {
    const { container } = render(<ResultBanner inline type="warning" title="Titel" />);
    expect(container.querySelector(".page-width")).toBeNull();
    expect(container.querySelector(".kern-alert")).toBeInTheDocument();
  });

  it("sits in the wide page section by default", () => {
    const { container } = render(<ResultBanner type="warning" title="Titel" />);
    expect(container.querySelector(".page-width--wide .kern-alert")).toBeInTheDocument();
  });
});
