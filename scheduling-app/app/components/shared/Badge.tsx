import type { ReactNode } from "react";

export type BadgeType = "success" | "info" | "warning" | "danger";

export function Badge({
  type,
  children,
}: Readonly<{ type: BadgeType; children: ReactNode }>) {
  return <span className={`kern-badge kern-badge--${type}`}>{children}</span>;
}
