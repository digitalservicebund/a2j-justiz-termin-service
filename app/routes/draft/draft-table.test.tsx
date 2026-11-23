import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { KernCell } from "~/components/shared/kern/KernTable";

import { DraftTable } from "./draft-table";

type Row = { id: string; name: string };

function renderTable({
  rows = [],
  limit = false,
  error,
}: { rows?: Row[]; limit?: boolean; error?: { id: string; message: string } } = {}) {
  return render(
    <form>
      <DraftTable
        caption="Personen"
        columns={["Name"]}
        rows={rows}
        empty="Keine Personen."
        renderCells={({ name }) => <KernCell>{name}</KernCell>}
        actions={({ id, name }) => [
          { intent: { command: "edit-person", id }, icon: "edit", label: `${name} bearbeiten` },
          { intent: { command: "delete-person", id }, icon: "delete", label: `${name} löschen` },
        ]}
        add={{
          intent: { command: "add-person" },
          label: "Person hinzufügen",
          limit,
          hint: "Höchstens zwei Personen.",
          hintId: "add-hint",
        }}
        error={error}
      />
    </form>,
  );
}

describe("DraftTable", () => {
  it("keeps the header and says so when it has no rows", () => {
    renderTable();

    const table = screen.getByRole("table", { name: "Personen" });
    expect(within(table).getByRole("columnheader", { name: "Name" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Aktionen" })).toBeInTheDocument();
    const empty = within(table).getByRole("cell", { name: "Keine Personen." });
    expect(empty).toHaveAttribute("colspan", "2");
  });

  it("renders a row per entry with buttons that submit the row's intent", () => {
    renderTable({
      rows: [
        { id: "p1", name: "Person A" },
        { id: "p2", name: "Person B" },
      ],
    });

    const table = screen.getByRole("table", { name: "Personen" });
    expect(within(table).getByRole("cell", { name: "Person A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Person A bearbeiten" })).toHaveAttribute(
      "value",
      "edit-person:p1",
    );
    const remove = screen.getByRole("button", { name: "Person B löschen" });
    expect(remove).toHaveAttribute("name", "intent");
    expect(remove).toHaveAttribute("value", "delete-person:p2");
    expect(remove).toHaveAttribute("type", "submit");
  });

  it("offers the add button while the table has room", () => {
    renderTable();

    const add = screen.getByRole("button", { name: "Person hinzufügen" });
    expect(add).toBeEnabled();
    expect(add).toHaveAttribute("value", "add-person");
    expect(add).not.toHaveAttribute("aria-describedby");
    expect(screen.queryByText("Höchstens zwei Personen.")).not.toBeInTheDocument();
  });

  it("disables the add button and explains why when the table is full", () => {
    renderTable({ limit: true });

    const add = screen.getByRole("button", { name: "Person hinzufügen" });
    expect(add).toBeDisabled();
    expect(add).toHaveAccessibleDescription("Höchstens zwei Personen.");
  });

  it("shows a problem with the whole table under it and marks the group", () => {
    const { container } = renderTable({
      error: { id: "people-error", message: "Geben Sie eine Person an." },
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Geben Sie eine Person an.");
    expect(container.querySelector("#people-error")).toBeInTheDocument();
    expect(container.querySelector(".create-termin__windows")).toHaveClass("kern-fieldset--error");
  });

  it("leaves the group unmarked without a problem", () => {
    const { container } = renderTable();

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(container.querySelector(".create-termin__windows")).not.toHaveClass(
      "kern-fieldset--error",
    );
  });
});
