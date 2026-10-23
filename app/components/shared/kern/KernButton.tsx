import type { ButtonHTMLAttributes, ReactNode } from "react";

import { KernLabel } from "./KernLabel";

type ButtonStyle = "primary" | "secondary" | "tertiary";

export type KernButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> & {
  style?: ButtonStyle;
  children?: ReactNode;
};

export function KernButton({
  style = "primary",
  className,
  children,
  ...buttonProps
}: Readonly<KernButtonProps>) {
  const styleClassMap: Record<ButtonStyle, string> = {
    primary: "kern-btn--primary",
    secondary: "kern-btn--secondary",
    tertiary: "kern-btn--tertiary",
  };

  const styleClass = styleClassMap[style];

  const classes = ["kern-btn", styleClass, className].filter(Boolean).join(" ");
  const content =
    typeof children === "string" || typeof children === "number" ? (
      <KernLabel>{children}</KernLabel>
    ) : (
      children
    );

  return (
    <button className={classes} {...buttonProps}>
      {content}
    </button>
  );
}
