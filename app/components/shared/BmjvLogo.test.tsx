import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BmjvLogo } from "./BmjvLogo";

// The fills of the logo's shapes in drawing order: the eagle, the three stripes of the flag, and
// the three lines of lettering.
function fills(file: string) {
  const svg = readFileSync(new URL(file, import.meta.url), "utf8");
  return [...svg.matchAll(/<path\b[^>]*\bfill="([^"]+)"/g)].map(([, fill]) => fill);
}

const FLAG = ["black", "#FF0000", "#FFCC00"];

describe("BmjvLogo", () => {
  it("names the ministry and swaps to the dark variant in the dark colour scheme", () => {
    const { container } = render(<BmjvLogo />);

    expect(
      screen.getByRole("img", { name: "Bundesministerium der Justiz und für Verbraucherschutz" }),
    ).toHaveAttribute("src", expect.stringContaining("bmjv-logo-light"));
    expect(container.querySelector("source")).toHaveAttribute(
      "media",
      "(prefers-color-scheme: dark)",
    );
    expect(container.querySelector("source")).toHaveAttribute(
      "srcset",
      expect.stringContaining("bmjv-logo-dark"),
    );
  });

  it("draws the eagle and the lettering in black on a light background", () => {
    expect(fills("./bmjv-logo-light.svg")).toEqual(["black", ...FLAG, "black", "black", "black"]);
  });

  it("draws the eagle and the lettering in white on a dark background, the flag unchanged", () => {
    expect(fills("./bmjv-logo-dark.svg")).toEqual(["white", ...FLAG, "white", "white", "white"]);
  });
});
