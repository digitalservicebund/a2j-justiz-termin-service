import type { ReactNode } from "react";

import "./KernBadge.css";

// "custom-grey" is not a standard KERN badge type; it is implemented in JTS (see KernBadge.css).
export type KernBadgeType = "custom-grey" | "success" | "info" | "warning" | "danger";

export function KernBadge({
  type,
  children,
}: Readonly<{ type: KernBadgeType; children: ReactNode }>) {
  const content =
    typeof children === "string" || typeof children === "number" ? (
      <span className="kern-label">{children}</span>
    ) : (
      children
    );

  return <span className={`kern-badge kern-badge--${type}`}>{content}</span>;
}
