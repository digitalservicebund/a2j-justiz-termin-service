import type { ReactNode } from "react";

import { ErrorMessage } from "~/components/shared/ErrorMessage";
import { KernButton } from "~/components/shared/kern/KernButton";
import { KernCluster } from "~/components/shared/kern/KernCluster";
import { KernIcon, type KernIconName } from "~/components/shared/kern/KernIcon";
import { KernLabel } from "~/components/shared/kern/KernLabel";
import { KernStack } from "~/components/shared/kern/KernStack";
import {
  KernCell,
  KernColumn,
  KernRow,
  KernTable,
  KernTableBody,
  KernTableHead,
} from "~/components/shared/kern/KernTable";
import { classNames } from "~/components/shared/kern/layout";

import { INTENT, intent, type DraftIntent } from "./intent";

// A button in the action column of a row.
type RowAction = { intent: DraftIntent; icon: KernIconName; label: string };

type DraftTableProps<Row extends { id: string }> = {
  caption: string;
  columns: readonly string[];
  rows: readonly Row[];
  // What the table says when it has no rows.
  empty: string;
  // The data cells of a row, one per column.
  renderCells: (row: Row, index: number) => ReactNode;
  actions: (row: Row) => readonly RowAction[];
  add: AddButtonProps;
  // A problem with the table as a whole, shown under it.
  error?: { id: string; message: string };
};

// A table of what the draft holds so far (participants or slots), with the buttons to change each
// row and a button below to add one. Every button submits the page's form with its intent.
export function DraftTable<Row extends { id: string }>({
  caption,
  columns,
  rows,
  empty,
  renderCells,
  actions,
  add,
  error,
}: Readonly<DraftTableProps<Row>>) {
  return (
    <KernStack
      gap="md"
      align="start"
      className={classNames("create-termin__windows", error && "kern-fieldset--error")}
    >
      <KernTable
        caption={caption}
        hideCaption
        striped={rows.length > 0}
        className="create-termin__table kern-w-full"
      >
        <KernTableHead>
          <KernRow>
            {columns.map((column) => (
              <KernColumn key={column}>{column}</KernColumn>
            ))}
            <KernColumn variant="action">Aktionen</KernColumn>
          </KernRow>
        </KernTableHead>
        <KernTableBody>
          {rows.length === 0 ? (
            <EmptyRow columns={columns.length + 1}>{empty}</EmptyRow>
          ) : (
            rows.map((row, index) => (
              <KernRow key={row.id}>
                {renderCells(row, index)}
                <KernCell variant="action">
                  <KernCluster wrap={false} gap="sm" justify="center">
                    {actions(row).map((action) => (
                      <RowButton key={intent(action.intent)} {...action} />
                    ))}
                  </KernCluster>
                </KernCell>
              </KernRow>
            ))
          )}
        </KernTableBody>
      </KernTable>
      <AddButton {...add} />
      {error && <ErrorMessage id={error.id}>{error.message}</ErrorMessage>}
    </KernStack>
  );
}

// The table keeps its header when it is empty and says so in a white row that spans every column.
function EmptyRow({ columns, children }: Readonly<{ columns: number; children: string }>) {
  return (
    <KernRow>
      <KernCell colSpan={columns} className="create-termin__empty">
        {children}
      </KernCell>
    </KernRow>
  );
}

function RowButton({ intent: value, icon, label }: Readonly<RowAction>) {
  return (
    <KernButton
      type="submit"
      name={INTENT}
      value={intent(value)}
      style="tertiary"
      aria-label={label}
    >
      <KernIcon name={icon} />
    </KernButton>
  );
}

type AddButtonProps = {
  intent: DraftIntent;
  label: string;
  // The table is full, so the button is disabled and the hint says why.
  limit: boolean;
  hint: string;
  hintId: string;
};

function AddButton({ intent: value, label, limit, hint, hintId }: Readonly<AddButtonProps>) {
  return (
    <>
      <KernButton
        type="submit"
        name={INTENT}
        value={intent(value)}
        style="secondary"
        className="kern-mt-md"
        disabled={limit}
        aria-describedby={limit ? hintId : undefined}
      >
        <KernIcon name="add" />
        <KernLabel>{label}</KernLabel>
      </KernButton>
      {limit && (
        <p className="kern-hint" id={hintId}>
          {hint}
        </p>
      )}
    </>
  );
}
