import type { ReactNode } from "react";

export type BadgeType = "success" | "info" | "warning" | "danger";

export function Badge({ type, children }: Readonly<{ type: BadgeType; children: ReactNode }>) {
  const content =
    typeof children === "string" || typeof children === "number" ? (
      <span className="kern-label">{children}</span>
    ) : (
      children
    );

  return <span className={`kern-badge kern-badge--${type}`}>{content}</span>;
}
