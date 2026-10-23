import type { HTMLAttributes } from "react";

export type KernBodyProps = HTMLAttributes<HTMLElement> & {
  as?: "p" | "span";
  size?: "small" | "large";
  bold?: boolean;
  muted?: boolean;
};

export function KernBody({
  as: Element = "p",
  size,
  bold = false,
  muted = false,
  className,
  children,
  ...bodyProps
}: Readonly<KernBodyProps>) {
  const classes = [
    "kern-body",
    size && `kern-body--${size}`,
    bold && "kern-body--bold",
    muted && "kern-body--muted",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Element className={classes} {...bodyProps}>
      {children}
    </Element>
  );
}
