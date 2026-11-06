import type { HTMLAttributes } from "react";

export type KernHeadingSize = "x-large" | "large" | "medium" | "small" | "title" | "title-small";

export type KernHeadingProps = Omit<HTMLAttributes<HTMLHeadingElement>, "style"> & {
  size: KernHeadingSize;
  // The heading level of the document outline. Without it the text is a plain paragraph.
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  // "none" takes away the margin of the heading, for text that a layout spaces itself.
  margin?: "none";
};

const sizeClassMap: Record<KernHeadingSize, string> = {
  "x-large": "kern-heading-x-large",
  large: "kern-heading-large",
  medium: "kern-heading-medium",
  small: "kern-heading-small",
  title: "kern-title",
  "title-small": "kern-title kern-title--small",
};

export function KernHeading({
  size,
  level,
  margin,
  className,
  children,
  ...headingProps
}: Readonly<KernHeadingProps>) {
  const classes = [sizeClassMap[size], margin && `kern-m-${margin}`, className]
    .filter(Boolean)
    .join(" ");
  const Element = level ? (`h${level}` as const) : "p";

  return (
    <Element className={classes} {...headingProps}>
      {children}
    </Element>
  );
}
