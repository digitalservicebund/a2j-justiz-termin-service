import type { HTMLAttributes } from "react";

import { type StackOptions, classNames, listRole, stackClassName } from "./layout";

export type KernStackProps = HTMLAttributes<HTMLElement> &
  StackOptions & {
    as?: "div" | "ul" | "ol" | "li" | "nav" | "section" | "fieldset" | "form" | "output";
  };

// Children one below the other, spaced with KERN's gap helpers. Without `align` they fill its
// width. A list or fieldset loses the bullets, margins and borders of the browser, so it stacks
// like any other element.
export function KernStack({
  as: Element = "div",
  gap,
  align,
  className,
  children,
  ...stackProps
}: Readonly<KernStackProps>) {
  return (
    <Element
      className={classNames(stackClassName({ gap, align }, Element), className)}
      {...listRole(Element)}
      {...stackProps}
    >
      {children}
    </Element>
  );
}
