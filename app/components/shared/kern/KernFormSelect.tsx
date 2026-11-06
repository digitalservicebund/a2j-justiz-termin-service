import type { ReactNode, SelectHTMLAttributes } from "react";

import { KernLabel } from "./KernLabel";
import { classNames } from "./layout";

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
  const wrapperClasses = classNames("kern-form-input", wrapperClassName);
  const selectClasses = classNames("kern-form-input__select", className);

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
