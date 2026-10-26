import { useEffect, useRef, type ReactNode } from "react";
import { Form, useNavigation } from "react-router";

import { ErrorMessage } from "./ErrorMessage";
import { KernButton } from "./kern/KernButton";
import { KernFormInput } from "./kern/KernFormInput";
import { KernIcon } from "./kern/KernIcon";
import { KernLabel } from "./kern/KernLabel";

import "./LoginForm.css";

type LoginFormProps = {
  // Address to show again after a submission.
  email?: string;
  // Why the submitted address was rejected.
  error?: ReactNode;
  // The login link was sent to the submitted address.
  sent?: boolean;
};

export function LoginForm({ email, error, sent = false }: Readonly<LoginFormProps>) {
  const navigation = useNavigation();
  const pending = navigation.state !== "idle";
  const sentRef = useRef<HTMLOutputElement>(null);

  useEffect(() => {
    if (sent && !pending) sentRef.current?.focus();
  }, [sent, pending]);

  return (
    <Form
      method="post"
      action="/?index"
      noValidate
      className={error ? "login-form login-form--error" : "login-form"}
    >
      <KernFormInput
        id="login-email"
        label="E-Mail-Adresse"
        name="email"
        type="email"
        autoComplete="email"
        defaultValue={email}
        invalid={Boolean(error)}
        aria-describedby={error ? "login-email-error" : undefined}
        required
      />
      <KernButton type="submit" disabled={pending}>
        <KernLabel>{pending ? "Wird gesendet…" : "Anmelden"}</KernLabel>
        <KernIcon name="arrow-forward" />
      </KernButton>
      {error && (
        <div className="login-form__message">
          <ErrorMessage id="login-email-error">{error}</ErrorMessage>
        </div>
      )}
      {sent && (
        <output ref={sentRef} className="login-form__message login-form__sent" tabIndex={-1}>
          <KernIcon name="success" />
          <p className="kern-body">
            Ihr Anmelde-Link wurde versendet und ist 5 Minuten gültig und kann nur einmal verwendet
            werden.
            <br />
            Sie haben keine E-Mail erhalten?{" "}
            <button type="submit" className="kern-link login-form__resend" disabled={pending}>
              Anmelde-Link erneut senden.
            </button>
          </p>
        </output>
      )}
    </Form>
  );
}
