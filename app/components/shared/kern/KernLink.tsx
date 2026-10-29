import type { ComponentPropsWithoutRef, ElementType } from "react";

type LinkSize = "default" | "small";

export type KernLinkProps<T extends ElementType = "a"> = {
  // The element to render, e.g. the react-router Link to link within the app. Defaults to "a".
  as?: T;
  size?: LinkSize;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "size">;

// A link styled as a KERN link. Pass a KernIcon as child, before or after the text.
export function KernLink<T extends ElementType = "a">({
  as,
  size,
  className,
  children,
  ...linkProps
}: Readonly<KernLinkProps<T>>) {
  const Component: ElementType = as ?? "a";
  const classes = ["kern-link", size === "small" && "kern-link--small", className]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classes} {...linkProps}>
      {children}
    </Component>
  );
}
