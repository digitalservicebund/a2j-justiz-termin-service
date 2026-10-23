import type { HTMLAttributes, ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";

type Alignment = "numeric" | "action";

export type KernTableProps = HTMLAttributes<HTMLTableElement> & {
  // Names the table for assistive technology. KERN asks for a caption on every table.
  caption: ReactNode;
  // Keeps the caption in the accessibility tree but hides it visually.
  hideCaption?: boolean;
  striped?: boolean;
  small?: boolean;
};

export function KernTable({
  caption,
  hideCaption = false,
  striped = false,
  small = false,
  className,
  children,
  ...tableProps
}: Readonly<KernTableProps>) {
  const classes = [
    "kern-table",
    striped && "kern-table--striped",
    small && "kern-table--small",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <table className={classes} {...tableProps}>
      <caption className={hideCaption ? "kern-title kern-sr-only" : "kern-title"}>
        {caption}
      </caption>
      {children}
    </table>
  );
}

export function KernTableHead({ children }: Readonly<{ children: ReactNode }>) {
  return <thead className="kern-table__head">{children}</thead>;
}

export function KernTableBody({ children }: Readonly<{ children: ReactNode }>) {
  return <tbody className="kern-table__body">{children}</tbody>;
}

export function KernRow({ children }: Readonly<{ children: ReactNode }>) {
  return <tr className="kern-table__row">{children}</tr>;
}

export type KernColumnProps = Omit<ThHTMLAttributes<HTMLTableCellElement>, "scope"> & {
  variant?: Alignment;
};

// A column header, `<th scope="col">`.
export function KernColumn({
  variant,
  className,
  children,
  ...cellProps
}: Readonly<KernColumnProps>) {
  const classes = ["kern-table__header", variant && `kern-table__header--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <th scope="col" className={classes} {...cellProps}>
      {children}
    </th>
  );
}

// A row header, `<th scope="row">`, which names its row for assistive technology.
export function KernRowHeader({
  className,
  children,
  ...cellProps
}: Readonly<Omit<ThHTMLAttributes<HTMLTableCellElement>, "scope">>) {
  const classes = ["kern-table__header", className].filter(Boolean).join(" ");

  return (
    <th scope="row" className={classes} {...cellProps}>
      {children}
    </th>
  );
}

export type KernCellProps = TdHTMLAttributes<HTMLTableCellElement> & {
  variant?: Alignment;
};

export function KernCell({ variant, className, children, ...cellProps }: Readonly<KernCellProps>) {
  const classes = ["kern-table__cell", variant && `kern-table__cell--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <td className={classes} {...cellProps}>
      {children}
    </td>
  );
}
