import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { gridColClassName, KernGrid, KernGridCol } from "~/components/shared/kern/KernGrid";

describe("KernGrid", () => {
  it("is a KERN row holding its cells", () => {
    render(
      <KernGrid data-testid="grid">
        <KernGridCol>Eins</KernGridCol>
      </KernGrid>,
    );
    const grid = screen.getByTestId("grid");
    expect(grid).toHaveClass("kern-row");
    expect(grid).toHaveTextContent("Eins");
  });

  it("maps justify, align and gapY to KERN's helper classes", () => {
    render(<KernGrid data-testid="grid" justify="center" align="start" gapY="xl" />);
    expect(screen.getByTestId("grid")).toHaveClass(
      "kern-justify-content-center",
      "kern-align-items-start",
      "kern-gap-y-xl",
    );
  });

  it("adds no alignment or gap without props", () => {
    render(<KernGrid data-testid="grid" />);
    expect(screen.getByTestId("grid").className).toBe("kern-row");
  });

  it("keeps a className passed in", () => {
    render(<KernGrid data-testid="grid" className="extra" />);
    expect(screen.getByTestId("grid")).toHaveClass("kern-row", "extra");
  });
});

describe("KernGridCol", () => {
  it("takes the full row without props, so cells stack on small screens", () => {
    render(<KernGridCol data-testid="col" />);
    expect(screen.getByTestId("col")).toHaveClass("kern-grid-col", "kern-col-12");
  });

  it("takes the given number of columns", () => {
    render(<KernGridCol data-testid="col" span={4} />);
    const col = screen.getByTestId("col");
    expect(col).toHaveClass("kern-col-4");
    expect(col).not.toHaveClass("kern-col-12");
  });

  it("changes its span from each breakpoint on", () => {
    render(<KernGridCol data-testid="col" sm={11} md={10} lg={9} xl={8} xxl={7} />);
    expect(screen.getByTestId("col")).toHaveClass(
      "kern-col-12",
      "kern-col-sm-11",
      "kern-col-md-10",
      "kern-col-lg-9",
      "kern-col-xl-8",
      "kern-col-xxl-7",
    );
  });

  it("renders the element it is told to and keeps a className", () => {
    render(<KernGridCol as="li" data-testid="col" className="extra" />);
    const col = screen.getByTestId("col");
    expect(col.tagName).toBe("LI");
    expect(col).toHaveClass("extra");
  });
});

describe("gridColClassName", () => {
  it("builds the classes of a cell for elements that are not a KernGridCol", () => {
    expect(gridColClassName({ lg: 3 })).toBe("kern-grid-col kern-col-12 kern-col-lg-3");
  });
});
