import type { FieldsetHTMLAttributes, ReactNode } from "react";

import { ErrorMessage } from "../ErrorMessage";

export type KernFieldsetProps = Omit<FieldsetHTMLAttributes<HTMLFieldSetElement>, "id"> & {
  id: string;
  legend: ReactNode;
  // Keeps the legend for screen readers only.
  hideLegend?: boolean;
  // Shows the message below the group, linked to the fieldset as `${id}-error`.
  error?: string;
  bodyClassName?: string;
};

export function KernFieldset({
  id,
  legend,
  hideLegend = false,
  error,
  bodyClassName,
  className,
  children,
  ...fieldsetProps
}: Readonly<KernFieldsetProps>) {
  const errorId = `${id}-error`;
  const classes = ["kern-fieldset", error && "kern-fieldset--error", className]
    .filter(Boolean)
    .join(" ");
  const bodyClasses = ["kern-fieldset__body", bodyClassName].filter(Boolean).join(" ");

  return (
    <fieldset
      id={id}
      className={classes}
      aria-describedby={error ? errorId : undefined}
      {...fieldsetProps}
    >
      <legend className={hideLegend ? "kern-sr-only" : "kern-label"}>{legend}</legend>
      <div className={bodyClasses}>{children}</div>
      {error && <ErrorMessage id={errorId}>{error}</ErrorMessage>}
    </fieldset>
  );
}
