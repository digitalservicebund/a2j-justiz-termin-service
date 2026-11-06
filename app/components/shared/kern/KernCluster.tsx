import type { HTMLAttributes } from "react";

import { type ClusterOptions, classNames, clusterClassName, listRole } from "./layout";

export type KernClusterProps = HTMLAttributes<HTMLElement> &
  ClusterOptions & {
    as?: "div" | "ul" | "ol" | "li" | "span" | "section" | "fieldset" | "form" | "output";
  };

// Children side by side, wrapping onto the next line when the space runs out.
export function KernCluster({
  as: Element = "div",
  gap,
  gapX,
  gapY,
  align,
  justify,
  wrap,
  inline,
  className,
  children,
  ...clusterProps
}: Readonly<KernClusterProps>) {
  return (
    <Element
      className={classNames(
        clusterClassName({ gap, gapX, gapY, align, justify, wrap, inline }, Element),
        className,
      )}
      {...listRole(Element)}
      {...clusterProps}
    >
      {children}
    </Element>
  );
}
