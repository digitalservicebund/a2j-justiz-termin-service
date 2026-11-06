import type { ComponentProps, ReactNode } from "react";
import { Form } from "react-router";

import { KernCluster } from "./kern/KernCluster";
import { type Space, classNames, stackClassName } from "./kern/layout";

import "./FormLayout.css";

export type FieldSize = "small" | "medium" | "large";

type FieldColumnProps = {
  // The widest the field grows: small 27rem (Aktenzeichen, name), medium 34rem (e-mail address),
  // large 45rem (admin forms). On a narrow screen it fills the width.
  size: FieldSize;
  children: ReactNode;
};

// Keeps a field, or a whole form, at the width of the design on wide screens instead of letting it
// grow with the page.
export function FieldColumn({ size, children }: Readonly<FieldColumnProps>) {
  return <div className={`field-column field-column--${size}`}>{children}</div>;
}

type FormStackProps = ComponentProps<typeof Form> & {
  // The space between the sections of the form.
  gap?: Space;
};

// A form whose sections stand one below the other.
export function FormStack({ gap = "xl", className, ...formProps }: Readonly<FormStackProps>) {
  return <Form className={classNames(stackClassName({ gap }), className)} {...formProps} />;
}

// The buttons that end a form, set apart from the fields above.
export function FormActions({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <KernCluster gap="md" className="kern-pt-md">
      {children}
    </KernCluster>
  );
}
