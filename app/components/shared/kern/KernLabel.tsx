import type { LabelHTMLAttributes, ReactNode } from "react";

export type KernLabelProps = {
  // Renders a <label> for the given control; without it the label is a plain <span>.
  htmlFor?: LabelHTMLAttributes<HTMLLabelElement>["htmlFor"];
  size?: "small";
  subtle?: boolean;
  className?: string;
  children: ReactNode;
};

export function KernLabel({
  htmlFor,
  size,
  subtle = false,
  className,
  children,
}: Readonly<KernLabelProps>) {
  const classes = [
    "kern-label",
    size && `kern-label--${size}`,
    subtle && "kern-label--subtle",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (htmlFor) {
    return (
      <label className={classes} htmlFor={htmlFor}>
        {children}
      </label>
    );
  }
  return <span className={classes}>{children}</span>;
}
