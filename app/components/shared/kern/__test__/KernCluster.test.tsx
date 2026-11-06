import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KernCluster } from "~/components/shared/kern/KernCluster";

describe("KernCluster", () => {
  it("renders the children side by side and wrapping", () => {
    render(
      <KernCluster data-testid="cluster">
        <span>Eins</span>
        <span>Zwei</span>
      </KernCluster>,
    );
    const cluster = screen.getByTestId("cluster");
    expect(cluster.tagName).toBe("DIV");
    expect(cluster).toHaveClass("kern-flex", "kern-flex-wrap");
    expect(cluster).toHaveTextContent("EinsZwei");
  });

  it("keeps the children in one row without wrap", () => {
    render(<KernCluster data-testid="cluster" wrap={false} />);
    expect(screen.getByTestId("cluster")).not.toHaveClass("kern-flex-wrap");
  });

  it("maps the gaps to KERN's helper classes", () => {
    render(<KernCluster data-testid="cluster" gap="sm" gapX="xl" gapY="xs" />);
    expect(screen.getByTestId("cluster")).toHaveClass(
      "kern-gap-sm",
      "kern-gap-x-xl",
      "kern-gap-y-xs",
    );
  });

  it("maps align and justify to KERN's helper classes", () => {
    render(<KernCluster data-testid="cluster" align="center" justify="between" />);
    expect(screen.getByTestId("cluster")).toHaveClass(
      "kern-align-items-center",
      "kern-justify-content-between",
    );
  });

  it("adds no gap, alignment or justification without props", () => {
    render(<KernCluster data-testid="cluster" />);
    expect(screen.getByTestId("cluster").className).not.toMatch(/kern-gap|kern-align|kern-justify/);
  });

  it("keeps a className passed in", () => {
    render(<KernCluster data-testid="cluster" className="extra" />);
    expect(screen.getByTestId("cluster")).toHaveClass("kern-flex", "extra");
  });

  it.each(["ul", "ol", "fieldset"] as const)("resets the browser styles of a %s", (as) => {
    render(<KernCluster as={as} data-testid="cluster" />);
    const cluster = screen.getByTestId("cluster");
    expect(cluster.tagName).toBe(as.toUpperCase());
    expect(cluster).toHaveClass("kern-m-none", "kern-p-none", "layout-reset");
  });
});

describe("KernCluster as a list", () => {
  it.each(["ul", "ol"] as const)("keeps the list role of a %s the reset takes away", (as) => {
    render(<KernCluster as={as} data-testid="cluster" />);
    expect(screen.getByTestId("cluster")).toHaveAttribute("role", "list");
  });

  it("adds no role to a block", () => {
    render(<KernCluster data-testid="cluster" />);
    expect(screen.getByTestId("cluster")).not.toHaveAttribute("role");
  });
});

describe("KernCluster as a list", () => {
  it.each(["ul", "ol"] as const)("keeps the list role of a %s the reset takes away", (as) => {
    render(<KernCluster as={as} data-testid="cluster" />);
    expect(screen.getByTestId("cluster")).toHaveAttribute("role", "list");
  });

  it("adds no role to a block", () => {
    render(<KernCluster data-testid="cluster" />);
    expect(screen.getByTestId("cluster")).not.toHaveAttribute("role");
  });
});
