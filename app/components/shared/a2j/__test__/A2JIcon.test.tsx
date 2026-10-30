import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { A2JIcon } from "~/components/shared/a2j/A2JIcon";

describe("A2JIcon", () => {
  it("applies the icon name class", () => {
    const { container } = render(<A2JIcon name="add-box" />);
    expect(container.firstChild).toHaveClass("a2j-icon--add-box");
  });

  it("uses default size when none is provided", () => {
    const { container } = render(<A2JIcon name="event" />);
    expect(container.firstChild).toHaveClass("kern-icon--default");
  });

  it("applies the icon class of every icon", () => {
    for (const name of ["calendar-add", "remove-circle", "settings"] as const) {
      const { container } = render(<A2JIcon name={name} />);
      expect(container.firstChild).toHaveClass(`a2j-icon--${name}`);
    }
  });

  it("applies a custom size class", () => {
    const { container } = render(<A2JIcon name="checklist-rtl" size="x-large" />);
    expect(container.firstChild).toHaveClass("kern-icon--x-large");
  });

  it("is hidden from assistive technology", () => {
    const { container } = render(<A2JIcon name="event" />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});
