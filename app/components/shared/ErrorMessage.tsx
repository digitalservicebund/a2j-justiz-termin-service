import type { ReactNode } from "react";

export function ErrorMessage({ id, children }: Readonly<{ id: string; children: ReactNode }>) {
  return (
    <p className="kern-error" id={id} role="alert">
      <span className="kern-icon kern-icon--danger" aria-hidden="true"></span>
      <span className="kern-body">{children}</span>
    </p>
  );
}
