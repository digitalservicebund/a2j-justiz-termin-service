import type { ComponentPropsWithoutRef, ReactNode } from "react";

import "./DefaultPage.css";

export type PageWidth = "narrow" | "default" | "wide";

export function pageWidthClass(width: PageWidth): string {
  return `page-width page-width--${width}`;
}

type DefaultPageProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  width?: PageWidth;
  as?: "div" | "section";
  children: ReactNode;
};

// A block centered at one of the page widths from app.css. Pages lay out their own content.
export function DefaultPage({
  width = "default",
  as: Element = "div",
  className,
  children,
  ...rest
}: Readonly<DefaultPageProps>) {
  return (
    <Element className={[pageWidthClass(width), className].filter(Boolean).join(" ")} {...rest}>
      {children}
    </Element>
  );
}
