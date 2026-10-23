import type { ReactNode } from "react";
import { Link, type LinkProps } from "react-router";

import { KernLabel } from "./KernLabel";

type ButtonStyle = "primary" | "secondary" | "tertiary";

export type KernLinkButtonProps = Omit<LinkProps, "style"> & {
  style?: ButtonStyle;
  children?: ReactNode;
};

// A navigation link that looks like a KERN button.
export function KernLinkButton({
  style = "primary",
  className,
  children,
  ...linkProps
}: Readonly<KernLinkButtonProps>) {
  const classes = ["kern-btn", `kern-btn--${style}`, className].filter(Boolean).join(" ");
  const content =
    typeof children === "string" || typeof children === "number" ? (
      <KernLabel>{children}</KernLabel>
    ) : (
      children
    );

  return (
    <Link className={classes} {...linkProps}>
      {content}
    </Link>
  );
}
