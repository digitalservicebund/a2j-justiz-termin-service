import type { HTMLAttributes, ReactNode } from "react";
import { classNames } from "./layout";

export type KernDescriptionListProps = HTMLAttributes<HTMLDListElement> & {
  // Stacks each key above its value.
  column?: boolean;
};

export function KernDescriptionList({
  column = false,
  className,
  children,
  ...listProps
}: Readonly<KernDescriptionListProps>) {
  const classes = classNames("kern-description-list", column && "kern-description-list--col", className);

  return (
    <dl className={classes} {...listProps}>
      {children}
    </dl>
  );
}

export function KernDescriptionListItem({
  label,
  children,
}: Readonly<{ label: ReactNode; children: ReactNode }>) {
  return (
    <div className="kern-description-list-item">
      <dt className="kern-description-list-item__key">{label}</dt>
      <dd className="kern-description-list-item__value">{children}</dd>
    </div>
  );
}
