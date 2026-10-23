import type { InputHTMLAttributes, ReactNode } from "react";

import { ErrorMessage } from "../ErrorMessage";
import { KernLabel } from "./KernLabel";

export type KernFormInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "size"> & {
  id: string;
  label: ReactNode;
  // Shows the message below the field, linked to the input as `${id}-error`.
  error?: string;
  // Marks the input as invalid when the message is shown elsewhere, for example by a fieldset.
  invalid?: boolean;
  // Fixed input width in characters.
  width?: 2 | 4;
  // A small, subtle label for inputs that belong to a group.
  compactLabel?: boolean;
  // Class for the field wrapper; `className` goes to the input.
  wrapperClassName?: string;
};

export function KernFormInput({
  id,
  label,
  error,
  invalid = false,
  width,
  compactLabel = false,
  wrapperClassName,
  className,
  ...inputProps
}: Readonly<KernFormInputProps>) {
  const hasError = Boolean(error);
  const errorId = `${id}-error`;
  const inputClasses = [
    "kern-form-input__input",
    width && `kern-form-input__input--width-${width}`,
    (hasError || invalid) && "kern-form-input__input--error",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const wrapperClasses = ["kern-form-input", hasError && "kern-form-input--error", wrapperClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClasses}>
      <KernLabel htmlFor={id} size={compactLabel ? "small" : undefined} subtle={compactLabel}>
        {label}
      </KernLabel>
      <input
        id={id}
        className={inputClasses}
        aria-invalid={hasError || invalid || undefined}
        aria-describedby={hasError ? errorId : undefined}
        {...inputProps}
      />
      {error && <ErrorMessage id={errorId}>{error}</ErrorMessage>}
    </div>
  );
}
