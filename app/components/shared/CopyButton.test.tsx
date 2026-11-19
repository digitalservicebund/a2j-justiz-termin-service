import { render, screen } from "@testing-library/react";
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
});
