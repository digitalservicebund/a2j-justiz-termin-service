import type { ReactNode, SelectHTMLAttributes } from "react";

import { KernLabel } from "./KernLabel";

export type KernFormSelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> & {
  id: string;
  label: ReactNode;
  // Class for the field wrapper; `className` goes to the select.
  wrapperClassName?: string;
  // The <option> elements.
  children: ReactNode;
};

export function KernFormSelect({
  id,
  label,
  wrapperClassName,
  className,
  children,
  ...selectProps
}: Readonly<KernFormSelectProps>) {
  const wrapperClasses = ["kern-form-input", wrapperClassName].filter(Boolean).join(" ");
  const selectClasses = ["kern-form-input__select", className].filter(Boolean).join(" ");

  return (
    <div className={wrapperClasses}>
      <KernLabel htmlFor={id}>{label}</KernLabel>
      <span className="kern-form-input__select-wrapper">
        <select id={id} className={selectClasses} {...selectProps}>
          {children}
        </select>
      </span>
    </div>
  );
}
