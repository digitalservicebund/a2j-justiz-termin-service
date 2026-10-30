import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ReportProblemButton } from "~/components/shared/ReportProblemButton";

describe("ReportProblemButton", () => {
  it("is a secondary button that does not submit a form", () => {
    render(<ReportProblemButton />);
    const button = screen.getByRole("button", { name: "Problem mit dieser Seite melden" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("kern-btn--secondary");
  });
});
