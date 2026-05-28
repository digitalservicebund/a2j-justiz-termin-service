import type { ReactNode } from "react";

export function Card({children, className}: Readonly<{children: ReactNode, className?: string}>) {
  return <section className={`bg-white rounded-2xl border border-slate-100 shadow-sm p-kern-space-default ${className}`}>
    {children}
  </section>
}