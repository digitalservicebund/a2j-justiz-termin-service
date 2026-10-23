import { Form, useNavigation } from "react-router";

import { KernButton } from "./kern/KernButton";
import { KernIcon } from "./kern/KernIcon";

import "./LoginForm.css";

export function LoginForm() {
  const navigation = useNavigation();
  const pending = navigation.state !== "idle";

  return (
    <Form method="post" action="/?index" className="login-form">
      <div className="kern-form-input">
        <label className="kern-label" htmlFor="login-email">
          E-Mail-Adresse
        </label>
        <input
          className="kern-form-input__input"
          id="login-email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <KernButton type="submit" disabled={pending}>
        <span className="kern-label">{pending ? "Wird gesendet…" : "Anmelden"}</span>
        <KernIcon name="arrow-forward" />
      </KernButton>
    </Form>
  );
}
