import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonStyle = "primary" | "secondary" | "tertiary";

export type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "style"
> & {
  style?: ButtonStyle;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  label?: ReactNode;
};

export function Button({
  style = "primary",
  className,
  iconLeft,
  iconRight,
  label = "",
  ...buttonProps
}: Readonly<ButtonProps>) {
  const styleClassMap: Record<ButtonStyle, string> = {
    primary: "kern-btn--primary",
    secondary: "kern-btn--secondary",
    tertiary: "kern-btn--tertiary",
  };

  const styleClass = styleClassMap[style];

  const classes = ["kern-btn", styleClass, className].filter(Boolean).join(" ");

  return (
    <button className={classes} {...buttonProps}>
      {iconLeft || null}
      {label && <span className="kern-label">{label}</span>}
      {iconRight || null}
    </button>
  );
}
