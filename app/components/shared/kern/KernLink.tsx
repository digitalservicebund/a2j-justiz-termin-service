import type { ComponentPropsWithoutRef, ElementType } from "react";

type LinkSize = "default" | "small";

export type KernLinkProps<T extends ElementType = "a"> = {
  // The element to render, e.g. the react-router Link to link within the app. Defaults to "a".
  as?: T;
  size?: LinkSize;
  // Styles visited links like unvisited ones. Defaults to false.
  noVisitedState?: boolean;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "size" | "noVisitedState">;

// A link styled as a KERN link. Pass a KernIcon as child, before or after the text.
export function KernLink<T extends ElementType = "a">({
  as,
  size,
  noVisitedState,
  className,
  children,
  ...linkProps
}: Readonly<KernLinkProps<T>>) {
  const Component: ElementType = as ?? "a";
  const classes = [
    "kern-link",
    size === "small" && "kern-link--small",
    noVisitedState && "kern-link--no-visited-state",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Component className={classes} {...linkProps}>
      {children}
    </Component>
  );
}
