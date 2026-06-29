import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <section
      className={`p-kern-space-default rounded-kern-default border border-slate-100 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900 ${className}`}
    >
      {children}
    </section>
  );
}
