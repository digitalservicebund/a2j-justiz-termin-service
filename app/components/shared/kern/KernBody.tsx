import type { HTMLAttributes } from "react";

export type KernBodyProps = HTMLAttributes<HTMLElement> & {
  as?: "p" | "span";
  size?: "small" | "large";
  bold?: boolean;
  muted?: boolean;
  // "none" takes away the margin KERN gives a paragraph, for text that a layout spaces itself.
  margin?: "none";
};

export function KernBody({
  as: Element = "p",
  size,
  bold = false,
  muted = false,
  margin,
  className,
  children,
  ...bodyProps
}: Readonly<KernBodyProps>) {
  const classes = [
    "kern-body",
    size && `kern-body--${size}`,
    bold && "kern-body--bold",
    muted && "kern-body--muted",
    margin && `kern-m-${margin}`,
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
