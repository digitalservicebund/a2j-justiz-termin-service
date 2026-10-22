import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonStyle = "primary" | "secondary" | "tertiary";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "style"> & {
  style?: ButtonStyle;
  children?: ReactNode;
};

export function Button({
  style = "primary",
  className,
  children,
  ...buttonProps
}: Readonly<ButtonProps>) {
  const styleClassMap: Record<ButtonStyle, string> = {
    primary: "kern-btn--primary",
    secondary: "kern-btn--secondary",
    tertiary: "kern-btn--tertiary",
  };

  const styleClass = styleClassMap[style];

  const classes = ["kern-btn", styleClass, className].filter(Boolean).join(" ");
  const content =
    typeof children === "string" || typeof children === "number" ? (
      <span className="kern-label">{children}</span>
    ) : (
      children
    );

  return (
    <button className={classes} {...buttonProps}>
      {content}
    </button>
  );
}
