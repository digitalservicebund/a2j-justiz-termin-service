import type { HTMLAttributes } from "react";

import { type Align, type Space, classNames, gapClasses, resetClasses } from "./layout";

export type KernStackProps = HTMLAttributes<HTMLElement> & {
  as?: "div" | "ul" | "ol" | "section" | "fieldset" | "form";
  // The space between the children.
  gap?: Space;
  // How the children line up across the stack. Without it they fill its width.
  align?: Align;
};

// Children one below the other, spaced with KERN's gap helpers. A list or fieldset loses the
// bullets, margins and borders of the browser, so it stacks like any other element.
export function KernStack({
  as: Element = "div",
  gap,
  align,
  className,
  children,
  ...stackProps
}: Readonly<KernStackProps>) {
  const classes = classNames(
    "kern-flex kern-flex-col",
    ...gapClasses(gap),
    align && `kern-align-items-${align}`,
    ...resetClasses(Element),
    className,
  );

  return (
    <Element className={classes} {...stackProps}>
      {children}
    </Element>
  );
}
