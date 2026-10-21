import type { ReactNode } from "react";

import "./Badge.css";

// "custom-grey" is not a standard KERN badge type; it is implemented in JTS (see Badge.css).
export type BadgeType = "custom-grey" | "success" | "info" | "warning" | "danger";

export function Badge({ type, children }: Readonly<{ type: BadgeType; children: ReactNode }>) {
  const content =
    typeof children === "string" || typeof children === "number" ? (
      <span className="kern-label">{children}</span>
    ) : (
      children
    );

  return <span className={`kern-badge kern-badge--${type}`}>{content}</span>;
}
