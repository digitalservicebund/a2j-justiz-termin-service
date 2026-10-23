import type { InputHTMLAttributes, ReactNode } from "react";

import { KernLabel } from "./KernLabel";

export type KernFormCheckProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "type"> & {
  id: string;
  type: "checkbox" | "radio";
  label: ReactNode;
  invalid?: boolean;
};

export function KernFormCheck({
  id,
  type,
  label,
  invalid = false,
  className,
  ...inputProps
}: Readonly<KernFormCheckProps>) {
  const inputClasses = [
    `kern-form-check__${type}`,
    invalid && `kern-form-check__${type}--error`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="kern-form-check">
      <input id={id} type={type} className={inputClasses} {...inputProps} />
      <KernLabel htmlFor={id}>{label}</KernLabel>
    </div>
  );
}
