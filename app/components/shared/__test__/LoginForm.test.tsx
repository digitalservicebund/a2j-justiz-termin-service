import { render, screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { describe, expect, it } from "vitest";

import { LoginForm } from "~/components/shared/LoginForm";

function renderForm(props: Parameters<typeof LoginForm>[0] = {}) {
  const Stub = createRoutesStub([{ path: "/", Component: () => <LoginForm {...props} /> }]);
  return render(<Stub />);
}

describe("LoginForm", () => {
  it("renders an empty form without messages", () => {
    const { container } = renderForm();
    expect(screen.getByRole("textbox", { name: "E‑Mail-Adresse" })).toHaveValue("");
    expect(screen.getByRole("button", { name: "Anmelden" })).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(container.querySelector(".login-form--error")).toBeNull();
  });

  it("shows the submitted address again", () => {
    renderForm({ email: "person.a@example.com" });
    expect(screen.getByRole("textbox", { name: "E‑Mail-Adresse" })).toHaveValue(
      "person.a@example.com",
    );
  });

  it("marks the field invalid and describes it with the error", () => {
    const { container } = renderForm({ error: "Etwas stimmt nicht." });
    const input = screen.getByRole("textbox", { name: "E‑Mail-Adresse" });
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription("Etwas stimmt nicht.");
    expect(screen.getByRole("alert")).toHaveTextContent("Etwas stimmt nicht.");
    expect(container.querySelector("form")).toHaveClass("login-form--error");
  });

  it("confirms the sent link, moves focus to it and offers to send it again", () => {
    renderForm({ email: "person.a@example.com", sent: true });
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(
      "Ihr Anmelde-Link wurde versendet, ist 5 Minuten gültig und kann nur einmal verwendet werden. Sie haben keine E‑Mail erhalten?",
    );
    expect(status.querySelector("br")).toBeNull();
    expect(status).toHaveFocus();
    expect(screen.getByRole("textbox", { name: "E‑Mail-Adresse" })).not.toBeInvalid();
    expect(screen.getByRole("button", { name: "Anmelde-Link erneut senden." })).toHaveAttribute(
      "type",
      "submit",
    );
  });

  it("lets the form be submitted without browser validation so the server can answer", () => {
    const { container } = renderForm();
    expect(container.querySelector("form")).toHaveAttribute("novalidate");
  });
});
