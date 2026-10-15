import type { ReactNode } from "react";

import "./Card.css";

export function Card({
  children,
  className = "",
}: Readonly<{ children: ReactNode; className?: string }>) {
  const classes = ["app-card", className].filter(Boolean).join(" ");

  return <section className={classes}>{children}</section>;
}
