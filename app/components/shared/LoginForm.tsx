import { Form, useNavigation } from "react-router";

import { KernButton } from "./kern/KernButton";
import { KernFormInput } from "./kern/KernFormInput";
import { KernIcon } from "./kern/KernIcon";
import { KernLabel } from "./kern/KernLabel";

import "./LoginForm.css";

export function LoginForm() {
  const navigation = useNavigation();
  const pending = navigation.state !== "idle";

  return (
    <Form method="post" action="/?index" className="login-form">
      <KernFormInput
        id="login-email"
        label="E-Mail-Adresse"
        name="email"
        type="email"
        autoComplete="email"
        required
      />
      <KernButton type="submit" disabled={pending}>
        <KernLabel>{pending ? "Wird gesendet…" : "Anmelden"}</KernLabel>
        <KernIcon name="arrow-forward" />
      </KernButton>
    </Form>
  );
}
