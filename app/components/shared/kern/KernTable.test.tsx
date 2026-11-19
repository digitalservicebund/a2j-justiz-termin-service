import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  KernCell,
  KernColumn,
  KernRow,
  KernRowHeader,
  KernTable,
  KernTableBody,
  KernTableHead,
} from "~/components/shared/kern/KernTable";

function renderTable(props: Partial<React.ComponentProps<typeof KernTable>> = {}) {
  return render(
    <KernTable caption="Fees" {...props}>
      <KernTableHead>
        <KernRow>
          <KernColumn>Service</KernColumn>
          <KernColumn variant="numeric">Amount</KernColumn>
          <KernColumn variant="action">Actions</KernColumn>
        </KernRow>
      </KernTableHead>
      <KernTableBody>
        <KernRow>
          <KernRowHeader>Waste</KernRowHeader>
          <KernCell variant="numeric">4</KernCell>
          <KernCell variant="action">Open</KernCell>
        </KernRow>
      </KernTableBody>
    </KernTable>,
  );
}

describe("KernTable", () => {
  it("renders an accessible table named by its caption", () => {
    renderTable();
    expect(screen.getByRole("table", { name: "Fees" })).toHaveClass("kern-table");
    expect(screen.getByText("Fees")).toHaveClass("kern-title");
    expect(screen.getByText("Fees")).not.toHaveClass("kern-sr-only");
  });

  it("hides the caption visually but keeps it as the table name", () => {
    renderTable({ hideCaption: true });
    expect(screen.getByRole("table", { name: "Fees" })).toBeVisible();
    expect(screen.getByText("Fees")).toHaveClass("kern-sr-only");
  });

  it("is neither striped nor small by default", () => {
    renderTable();
    expect(screen.getByRole("table")).not.toHaveClass("kern-table--striped");
    expect(screen.getByRole("table")).not.toHaveClass("kern-table--small");
  });

  it("applies the striped and small variants and custom classes", () => {
    renderTable({ striped: true, small: true, className: "custom" });
    expect(screen.getByRole("table")).toHaveClass(
      "kern-table",
      "kern-table--striped",
      "kern-table--small",
      "custom",
    );
  });

  it("renders column headers with scope col and row headers with scope row", () => {
    renderTable();
    expect(screen.getByRole("columnheader", { name: "Service" })).toHaveAttribute("scope", "col");
    expect(screen.getByRole("rowheader", { name: "Waste" })).toHaveAttribute("scope", "row");
    expect(screen.getByRole("rowheader", { name: "Waste" })).toHaveClass("kern-table__header");
  });

  it("uses the KERN structure classes", () => {
    const { container } = renderTable();
    expect(container.querySelector("thead")).toHaveClass("kern-table__head");
    expect(container.querySelector("tbody")).toHaveClass("kern-table__body");
    expect(container.querySelectorAll("tr")).toHaveLength(2);
    for (const row of container.querySelectorAll("tr")) {
      expect(row).toHaveClass("kern-table__row");
    }
  });

  it("aligns numeric and action columns and cells", () => {
    renderTable();
    expect(screen.getByRole("columnheader", { name: "Amount" })).toHaveClass(
      "kern-table__header--numeric",
    );
    expect(screen.getByRole("columnheader", { name: "Actions" })).toHaveClass(
      "kern-table__header--action",
    );
    expect(screen.getByRole("cell", { name: "4" })).toHaveClass("kern-table__cell--numeric");
    expect(screen.getByRole("cell", { name: "Open" })).toHaveClass("kern-table__cell--action");
  });

  it("leaves cells unaligned by default", () => {
    render(
      <table>
        <tbody>
          <tr>
            <KernCell className="custom">Text</KernCell>
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByRole("cell")).toHaveClass("kern-table__cell", "custom");
    expect(screen.getByRole("cell")).not.toHaveClass("kern-table__cell--numeric");
  });
});
