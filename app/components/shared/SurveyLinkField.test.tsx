import { render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SurveyLinkField } from "~/components/shared/SurveyLinkField";

const url = "https://example.com/umfrage/0b1f2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";

describe("SurveyLinkField", () => {
  it("shows the whole link in a labelled, read-only field with a copy hint", () => {
    render(<SurveyLinkField id="link" url={url} />);
    const field = screen.getByRole("textbox", { name: "Link zur Terminumfrage" });
    expect(field).toHaveValue(url);
    expect(field).toHaveAttribute("readonly");
    expect(field).toHaveAccessibleDescription(/Strg\+C/);
  });

  it("offers the copy button only with JavaScript", () => {
    expect(renderToString(<SurveyLinkField id="link" url={url} />)).not.toContain("<button");
    render(<SurveyLinkField id="link" url={url} />);
    expect(
      screen.getByRole("button", { name: "Link zur Terminumfrage kopieren" }),
    ).toBeInTheDocument();
  });
});
