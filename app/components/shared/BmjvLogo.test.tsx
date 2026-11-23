import { readFileSync } from "node:fs";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BmjvLogo } from "./BmjvLogo";

// The fills of the logo's shapes in drawing order: the lettering, the eagle, then the flag.
function fills(file: string) {
  const svg = readFileSync(new URL(file, import.meta.url), "utf8");
  return [...svg.matchAll(/<path\b[^>]*\bfill="([^"]+)"/g)].map(([, fill]) => fill);
}

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

  it("draws the lettering and the eagle in black on a light background, next to the coloured flag", () => {
    expect(fills("./bmjv-logo-light.svg")).toEqual([
      "black",
      "black",
      "black",
      "#DC0000",
      "#F0B405",
    ]);
  });

  it("draws the whole logo in white on a dark background, the flag as hatched stripes", () => {
    const dark = fills("./bmjv-logo-dark.svg");

    expect(new Set(dark)).toEqual(new Set(["white"]));
    // Lettering, eagle, the solid top stripe and the hatching of the two lower stripes.
    expect(dark.length).toBeGreaterThan(5);
  });
});
