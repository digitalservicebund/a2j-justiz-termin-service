import type { HTMLAttributes } from "react";

import { type Align, type Justify, type Space, classNames } from "./layout";

import "./KernGrid.css";

export type KernGridProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "ul" | "ol" | "section";
  // Where the columns of a row that is not full stand.
  justify?: Justify;
  align?: Align;
  // The space between the rows the cells wrap into. The gutter between columns is KERN's own.
  gapY?: Space;
};

// A row of KERN's 12-column grid. It belongs inside a kern-container (PageSection, SidebarPage), as
// KERN's grid styles its columns only there. Put KernGridCol in it.
export function KernGrid({
  as: Element = "div",
  justify,
  align,
  gapY,
  className,
  children,
  ...gridProps
}: Readonly<KernGridProps>) {
  const classes = classNames(
    "kern-row",
    justify && `kern-justify-content-${justify}`,
    align && `kern-align-items-${align}`,
    gapY && `kern-gap-y-${gapY}`,
    className,
  );

  return (
    <Element className={classes} {...gridProps}>
      {children}
    </Element>
  );
}

export type GridSpan = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export type KernGridColProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "li" | "section" | "nav" | "aside";
  // How many of the 12 columns the cell takes. Without the other props it holds from the smallest
  // screen up, and the default is the full row, so the cells stack on small screens.
  span?: GridSpan;
  // The span from the breakpoint on: sm 576px, md 768px, lg 992px, xl 1200px, xxl 1600px.
  sm?: GridSpan;
  md?: GridSpan;
  lg?: GridSpan;
  xl?: GridSpan;
  xxl?: GridSpan;
};

export function gridColClassName({
  span = 12,
  sm,
  md,
  lg,
  xl,
  xxl,
}: Pick<KernGridColProps, "span" | "sm" | "md" | "lg" | "xl" | "xxl"> = {}): string {
  return classNames(
    "kern-grid-col",
    `kern-col-${span}`,
    sm && `kern-col-sm-${sm}`,
    md && `kern-col-md-${md}`,
    lg && `kern-col-lg-${lg}`,
    xl && `kern-col-xl-${xl}`,
    xxl && `kern-col-xxl-${xxl}`,
  );
}

// A cell of a KernGrid row.
export function KernGridCol({
  as: Element = "div",
  span,
  sm,
  md,
  lg,
  xl,
  xxl,
  className,
  children,
  ...colProps
}: Readonly<KernGridColProps>) {
  return (
    <Element
      className={classNames(gridColClassName({ span, sm, md, lg, xl, xxl }), className)}
      {...colProps}
    >
      {children}
    </Element>
  );
}
