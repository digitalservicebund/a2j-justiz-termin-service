import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  KernDescriptionList,
  KernDescriptionListItem,
} from "~/components/shared/kern/KernDescriptionList";

describe("KernDescriptionList", () => {
  it("renders items with their key and value", () => {
    render(
      <KernDescriptionList>
        <KernDescriptionListItem label="Key">Value</KernDescriptionListItem>
      </KernDescriptionList>,
    );
    expect(screen.getByText("Key")).toHaveClass("kern-description-list-item__key");
    expect(screen.getByText("Value")).toHaveClass("kern-description-list-item__value");
  });

  it("is not stacked by default", () => {
    const { container } = render(<KernDescriptionList />);
    expect(container.firstChild).toHaveClass("kern-description-list");
    expect(container.firstChild).not.toHaveClass("kern-description-list--col");
  });

  it("stacks keys above values with column", () => {
    const { container } = render(<KernDescriptionList column className="custom" />);
    expect(container.firstChild).toHaveClass("kern-description-list--col", "custom");
  });
});
