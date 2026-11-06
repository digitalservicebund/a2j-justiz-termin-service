import type { HTMLAttributes } from "react";

import { classNames } from "./layout";

export type KernBodyProps = HTMLAttributes<HTMLElement> & {
  as?: "p" | "span";
  size?: "small" | "large";
  bold?: boolean;
  muted?: boolean;
};

// A paragraph in KERN's body style. Text that a layout spaces itself takes `kern-m-none` in its
// className, which removes the margin KERN gives a paragraph.
export function KernBody({
  as: Element = "p",
  size,
  bold = false,
  muted = false,
  className,
  children,
  ...bodyProps
}: Readonly<KernBodyProps>) {
  const classes = classNames(
    "kern-body",
    size && `kern-body--${size}`,
    bold && "kern-body--bold",
    muted && "kern-body--muted",
    className,
  );

  return (
    <Element className={classes} {...bodyProps}>
      {children}
    </Element>
  );
}
