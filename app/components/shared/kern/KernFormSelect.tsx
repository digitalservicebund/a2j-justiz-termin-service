import type { ReactNode, SelectHTMLAttributes } from "react";

import { ErrorMessage } from "~/components/shared/ErrorMessage";

import { KernLabel } from "./KernLabel";
import { classNames } from "./layout";

export type KernFormSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  id: string;
  label: ReactNode;
  // Shows the message below the field, linked to the select as `${id}-error`.
  error?: string;
  // Explains the field between its label and the select, linked to the select as `${id}-hint`.
  hint?: ReactNode;
  // Class for the field wrapper; `className` goes to the select.
  wrapperClassName?: string;
  // The <option> elements.
  children: ReactNode;
};

export function KernFormSelect({
  id,
  label,
  error,
  hint,
  wrapperClassName,
  className,
  children,
  ...selectProps
}: Readonly<KernFormSelectProps>) {
  const hasError = Boolean(error);
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [hint && hintId, hasError && errorId].filter(Boolean).join(" ") || undefined;
  const wrapperClasses = classNames(
    "kern-form-input",
    hasError && "kern-form-input--error",
    wrapperClassName,
  );
  const selectClasses = classNames(
    "kern-form-input__select",
    hasError && "kern-form-input__select--error",
    className,
  );

  return (
    <div className={wrapperClasses}>
      <KernLabel htmlFor={id}>{label}</KernLabel>
      {hint && (
        <p className="kern-hint" id={hintId}>
          {hint}
        </p>
      )}
      <span className="kern-form-input__select-wrapper">
        <select
          id={id}
          className={selectClasses}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy}
          {...selectProps}
        >
          {children}
        </select>
      </span>
      {error && <ErrorMessage id={errorId}>{error}</ErrorMessage>}
    </div>
  );
}
