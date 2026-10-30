// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Link } from "../../../components/shared/footer-links.ts";

const squash = (html: string) => html.replace(/\s+/g, " ").replace(/\s+>/g, ">");

const retarget = (links: Link[]) =>
  links.map((link) => ({ ...link, href: `https://example.com/${link.label}` }));

// The placeholder targets of the page footer are filtered out of mails, so the groups are tested
// once with the real links and once with targets for every link.
async function loadParts(withTargets: boolean) {
  vi.resetModules();
  if (withTargets) {
    vi.doMock("../../../components/shared/footer-links.ts", async (importOriginal) => {
      const original = await importOriginal<Record<string, Link[]>>();
      return {
        ...original,
        contactLinks: retarget(original.contactLinks),
        legalLinks: retarget(original.legalLinks),
      };
    });
  }
  return import("../email-parts.ts");
}

afterEach(() => {
  vi.doUnmock("../../../components/shared/footer-links.ts");
});

describe("e-mail footer", () => {
  it("shows both link groups with their links when every link has a target", async () => {
    const { Footer, renderFooterText } = await loadParts(true);
    const html = squash(Footer());
    expect(html).toContain("Kontakt und Teilnahme");
    expect(html).toContain("Rechtliche Hinweise");
    for (const label of ["Impressum", "Barrierefreiheit", "Datenschutz", "Kontakt"]) {
      expect(html).toMatch(new RegExp(`<a href="https://example.com/${label}"[^>]*>${label}`));
    }

    const text = renderFooterText();
    expect(text).toContain("Rechtliche Hinweise");
    expect(text).toContain("Impressum: https://example.com/Impressum");
  });

  it("orders contact, legal notices, pilot, operator and address", async () => {
    const { renderFooterText } = await loadParts(true);
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

  it("leaves out a group whose links have no target yet", async () => {
    const { Footer, renderFooterText } = await loadParts(false);
    const html = squash(Footer());
    expect(html).toContain("Kontakt und Teilnahme");
    expect(html).toContain("Open Source Code");
    expect(html).not.toContain("Rechtliche Hinweise");
    expect(html).not.toContain("Datenschutz");
    expect(html).not.toContain('href="#"');

    const text = renderFooterText().join("\n");
    expect(text).not.toContain("Rechtliche Hinweise");
    expect(text).not.toContain("#");
  });
});
