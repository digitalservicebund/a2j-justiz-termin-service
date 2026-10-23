import type { ReactNode } from "react";

import "./DefaultPage.css";

export type PageWidth = "narrow" | "default" | "wide";

export function pageWidthClass(width: PageWidth): string {
  return `page-width page-width--${width}`;
}

type DefaultPageProps = {
  width?: PageWidth;
  children: ReactNode;
};

// A block centered at one of the page widths from app.css. Pages lay out their own content in
// the elements they put inside it.
export function DefaultPage({ width = "default", children }: Readonly<DefaultPageProps>) {
  return <div className={pageWidthClass(width)}>{children}</div>;
}
