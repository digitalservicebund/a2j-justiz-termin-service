import type { HTMLAttributes } from "react";

import {
  type Align,
  type Justify,
  type Space,
  classNames,
  gapClasses,
  resetClasses,
} from "./layout";

export type KernClusterProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "ul" | "ol" | "span" | "section" | "fieldset";
  gap?: Space;
  gapX?: Space;
  gapY?: Space;
  align?: Align;
  justify?: Justify;
  // Children that do not fit move to the next line. Turn it off to keep them in one row.
  wrap?: boolean;
};

// Children side by side, wrapping onto the next line when the space runs out.
export function KernCluster({
  as: Element = "div",
  gap,
  gapX,
  gapY,
  align,
  justify,
  wrap = true,
  className,
  children,
  ...clusterProps
}: Readonly<KernClusterProps>) {
  const classes = classNames(
    "kern-flex",
    wrap && "kern-flex-wrap",
    ...gapClasses(gap, gapX, gapY),
    align && `kern-align-items-${align}`,
    justify && `kern-justify-content-${justify}`,
    ...resetClasses(Element),
    className,
  );

  return (
    <Element className={classes} {...clusterProps}>
      {children}
    </Element>
  );
}
