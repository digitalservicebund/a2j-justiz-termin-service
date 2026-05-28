import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: Readonly<{ children: ReactNode; className?: string }>) {
  return (
    <section
      className={`p-kern-space-default rounded-2xl border border-slate-100 bg-white shadow-sm ${className}`}
    >
      {children}
    </section>
  );
}
