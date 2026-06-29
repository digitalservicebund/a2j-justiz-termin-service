import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Icon } from "~/components/shared/Icon";

describe("Icon", () => {
  it("applies the icon name class", () => {
    const { container } = render(<Icon name="check" />);
    expect(container.firstChild).toHaveClass("kern-icon--check");
  });

  it("uses default size when none is provided", () => {
    const { container } = render(<Icon name="check" />);
    expect(container.firstChild).toHaveClass("kern-icon--default");
  });

  it("applies a custom size class", () => {
    const { container } = render(<Icon name="check" size="large" />);
    expect(container.firstChild).toHaveClass("kern-icon--large");
  });

  it("is hidden from assistive technology", () => {
    const { container } = render(<Icon name="check" />);
    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
  });
});
