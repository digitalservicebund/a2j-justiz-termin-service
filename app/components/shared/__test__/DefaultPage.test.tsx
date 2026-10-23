import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DefaultPage } from "~/components/shared/DefaultPage";

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

  it.each(["narrow", "default", "wide"] as const)("applies the %s width", (width) => {
    const { container } = render(<DefaultPage width={width}>x</DefaultPage>);
    expect(container.firstChild).toHaveClass(`page-width--${width}`);
  });
});
