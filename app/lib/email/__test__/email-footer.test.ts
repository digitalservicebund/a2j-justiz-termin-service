// @vitest-environment node
import { describe, expect, it } from "vitest";

import { Footer, renderFooterText } from "../email-parts.ts";

const squash = (html: string) => html.replace(/\s+/g, " ").replace(/\s+>/g, ">");

describe("e-mail footer", () => {
  it("shows both link groups with their links", () => {
    const html = squash(Footer());
    expect(html).toContain("Kontakt und Teilnahme");
    expect(html).toContain("Rechtliche Hinweise");
    for (const [label, href] of [
      ["Impressum", "https://service.justiz.de/impressum"],
      ["Barrierefreiheit", "https://service.justiz.de/barrierefreiheit"],
      ["Datenschutz", "https://service.justiz.de/datenschutzerklaerung"],
      ["Kontakt", "https://service.justiz.de/kontakt"],
    ]) {
      expect(html).toMatch(new RegExp(`<a href="${href}"[^>]*>${label}`));
    }
    expect(html).not.toContain('href="#"');

    const text = renderFooterText();
    expect(text).toContain("Rechtliche Hinweise");
    expect(text).toContain("Impressum: https://service.justiz.de/impressum");
  });

  it("styles every footer link like a KERN link", () => {
    const html = squash(Footer());
    const styles = [...html.matchAll(/<a href="[^"]*" style="([^"]*)"/g)].map(([, style]) => style);
    expect(styles.length).toBeGreaterThan(1);
    expect(new Set(styles).size).toBe(1);
    expect(styles[0]).toContain("text-decoration:underline");
    expect(styles[0]).toContain("text-underline-offset:3px");
  });

  it("orders contact, legal notices, pilot, operator and address", () => {
    const text = renderFooterText().join("\n");
    const positions = [
      "Kontakt und Teilnahme",
      "Rechtliche Hinweise",
      "Ein Pilotprojekt des",
      "Umsetzung und Betrieb durch",
      "Prinzessinnenstraße",
    ].map((part) => text.indexOf(part));
    expect(positions.every((position) => position >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});
