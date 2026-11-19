import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { A2JInlineNotice } from "~/components/shared/a2j/A2JInlineNotice";

describe("A2JInlineNotice", () => {
  it("renders the title and the description", () => {
    render(
      <A2JInlineNotice type="information" title="Fehlende Unterlagen">
        Das Gericht kann weitere Unterlagen anfordern.
      </A2JInlineNotice>,
    );
    expect(screen.getByText("Fehlende Unterlagen")).toBeInTheDocument();
    expect(screen.getByText("Das Gericht kann weitere Unterlagen anfordern.")).toBeInTheDocument();
  });

  it.each([
    ["warning", "Warnung", "kern-icon--warning"],
    ["information", "Information", "kern-icon--info"],
    ["success", "Erfolg", "kern-icon--success"],
    ["error", "Fehler", "kern-icon--danger"],
  ] as const)(
    "styles the '%s' type and names its icon '%s' for screen readers",
    (type, label, iconClass) => {
      const { container } = render(<A2JInlineNotice type={type} title="Titel" />);
      expect(container.firstChild).toHaveClass("a2j-inline-notice", `a2j-inline-notice--${type}`);
      const icon = container.querySelector(`.${iconClass}`);
      expect(icon).toHaveClass("kern-icon");
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(screen.getByText(label)).toHaveClass("kern-sr-only");
    },
  );

  it("keeps the icon label out of the heading", () => {
    render(<A2JInlineNotice type="warning" title="Titel" headingLevel={2} />);
    expect(screen.getByRole("heading", { level: 2 })).toHaveAccessibleName("Titel");
  });

  it("is a plain paragraph without a heading level", () => {
    render(<A2JInlineNotice type="warning" title="Titel" />);
    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("Titel").tagName).toBe("P");
  });

  it.each([2, 3, 4, 5, 6] as const)("renders the title as an h%i when asked", (level) => {
    render(<A2JInlineNotice type="warning" title="Titel" headingLevel={level} />);
    expect(screen.getByRole("heading", { level, name: "Titel" })).toBeInTheDocument();
  });

  it("is not a live region", () => {
    render(
      <A2JInlineNotice type="error" title="Titel">
        Text
      </A2JInlineNotice>,
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("has no body without a description or a link", () => {
    const { container } = render(<A2JInlineNotice type="success" title="Titel" />);
    expect(container.querySelector(".a2j-inline-notice__body")).not.toBeInTheDocument();
  });

  it("renders the description as list items", () => {
    render(
      <A2JInlineNotice type="information" title="Titel">
        <ul>
          <li>Erster Punkt</li>
          <li>Zweiter Punkt</li>
        </ul>
      </A2JInlineNotice>,
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
  });

  it("renders the link below the description", () => {
    render(
      <A2JInlineNotice
        type="information"
        title="Titel"
        link={{ href: "/weiter", label: "Mehr erfahren" }}
      >
        Text
      </A2JInlineNotice>,
    );
    expect(screen.getByRole("link", { name: "Mehr erfahren" })).toHaveAttribute("href", "/weiter");
  });

  it("shows a link without a description", () => {
    render(
      <A2JInlineNotice type="warning" title="Titel" link={{ href: "/weiter", label: "Weiter" }} />,
    );
    expect(screen.getByRole("link", { name: "Weiter" })).toBeInTheDocument();
  });
});
