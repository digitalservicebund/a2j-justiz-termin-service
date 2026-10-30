import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DefaultPage, PageSection } from "~/components/shared/DefaultPage";

describe("DefaultPage", () => {
  it("renders the children", () => {
    render(
      <DefaultPage>
        <p>Inhalt</p>
      </DefaultPage>,
    );
    expect(screen.getByText("Inhalt")).toBeInTheDocument();
  });

  it("uses the default width without a width", () => {
    const { container } = render(<DefaultPage>x</DefaultPage>);
    expect(container.firstChild).toHaveClass("page-width", "page-width--default");
  });

  it.each(["narrow", "content", "default", "wide"] as const)("applies the %s width", (width) => {
    const { container } = render(<DefaultPage width={width}>x</DefaultPage>);
    expect(container.firstChild).toHaveClass(`page-width--${width}`);
  });

  it("ends with the report-problem button inside the same width", () => {
    const { container } = render(
      <DefaultPage width="wide">
        <p>Inhalt</p>
      </DefaultPage>,
    );
    const button = screen.getByRole("button", { name: "Problem mit dieser Seite melden" });
    expect(container.firstChild).toContainElement(button);
    expect(container.firstChild?.lastChild).toContainElement(button);
  });

  it("shows the button even without children", () => {
    render(<DefaultPage />);
    expect(
      screen.getByRole("button", { name: "Problem mit dieser Seite melden" }),
    ).toBeInTheDocument();
  });
});

describe("PageSection", () => {
  it("centers the children at the given width without a report-problem button", () => {
    const { container } = render(<PageSection width="narrow">Inhalt</PageSection>);
    expect(container.firstChild).toHaveClass("page-width", "page-width--narrow");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("uses the default width without a width", () => {
    const { container } = render(<PageSection>x</PageSection>);
    expect(container.firstChild).toHaveClass("page-width--default");
  });
});
