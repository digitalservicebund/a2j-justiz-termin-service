import type { InputHTMLAttributes, ReactNode } from "react";

import { KernLabel } from "./KernLabel";
import { classNames } from "./layout";

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
  const inputClasses = classNames(
    `kern-form-check__${type}`,
    invalid && `kern-form-check__${type}--error`,
    className,
  );

  return (
    <div className="kern-form-check">
      <input id={id} type={type} className={inputClasses} {...inputProps} />
      <KernLabel htmlFor={id}>{label}</KernLabel>
    </div>
  );
}
