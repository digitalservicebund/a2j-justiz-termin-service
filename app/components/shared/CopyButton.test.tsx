import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CopyButton } from "~/components/shared/CopyButton";

const props = {
  text: "Text",
  label: "Kopieren",
  copiedLabel: "Kopiert",
  announcement: "Text kopiert.",
};

describe("CopyButton", () => {
  it("is not rendered on the server, so there is no dead button without JavaScript", () => {
    expect(renderToString(<CopyButton {...props} />)).not.toContain("Kopieren");
  });

  it("appears once the page has hydrated", () => {
    render(<CopyButton {...props} />);
    expect(screen.getByRole("button", { name: "Kopieren" })).toBeInTheDocument();
  });

  it("shows the given icon until the text is copied, then the check icon", async () => {
    const user = userEvent.setup();
    render(<CopyButton {...props} icon={<span data-testid="custom-icon" />} />);

    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Kopieren" }));

    const button = screen.getByRole("button", { name: "Kopiert" });
    expect(screen.queryByTestId("custom-icon")).not.toBeInTheDocument();
    expect(button.querySelector(".kern-icon--check")).not.toBeNull();
  });
});
