// @vitest-environment node
import { describe, expect, it } from "vitest";

import { renderMagicLinkEmail } from "../magic-link-email";

// The formatter indents the templates and wraps long tags, which does not change how a mail renders.
const squash = (html: string) => html.replace(/\s+/g, " ").replace(/\s+>/g, ">");

const url = "http://localhost:3000/api/auth/magic-link/verify?token=abc&callbackURL=%2Foverview";

describe("renderMagicLinkEmail", () => {
  it("uses the verification copy for a new address", () => {
    const mail = renderMagicLinkEmail("signup", url);
    expect(mail.subject).toBe("Verifizieren Sie Ihre E-Mail-Adresse");
    expect(mail.html).toContain("um ein Konto beim Verhandlungstermin-Finder zu erstellen.");
    expect(mail.html).toContain("E-Mail-Adresse verifizieren");
    expect(mail.text).toContain("E-Mail-Adresse verifizieren:");
  });

  it("uses the login copy for an existing account", () => {
    const mail = renderMagicLinkEmail("login", url);
    expect(mail.subject).toBe("Anmelden beim Verhandlungstermin-Finder");
    expect(mail.html).toContain("Melden Sie sich beim Verhandlungstermin-Finder an.");
    expect(mail.html).not.toContain("Konto");
  });

  it("puts the raw link first in the plaintext version", () => {
    const { text } = renderMagicLinkEmail("signup", url);
    expect(text.match(/https?:\/\/\S+/)?.[0]).toBe(url);
    expect(text).toContain("Der Link ist 5 Minuten gültig und kann nur einmal verwendet werden.");
  });

  it("escapes the link in the HTML version and keeps the plaintext raw", () => {
    const hostile = 'http://localhost/x?a=1&b="><script>alert(1)</script>';
    const { html, text } = renderMagicLinkEmail("login", hostile);
    expect(html).not.toContain("<script>");
    expect(html).toContain("http://localhost/x?a=1&amp;b=&quot;&gt;&lt;script&gt;");
    expect(text).toContain(hostile);
  });

  it("does not escape its own markup twice", () => {
    for (const variant of ["signup", "login"] as const) {
      const html = squash(renderMagicLinkEmail(variant, url).html);
      expect(html).not.toMatch(/&lt;|&gt;|&quot;/);
      expect(html).toMatch(/<a href="https:\/\/github\.com\/[^"]+"[^>]*>Open Source Code/);
    }
  });

  it("builds a client-safe document", () => {
    const html = squash(renderMagicLinkEmail("signup", url).html);
    expect(html).toMatch(/^<!DOCTYPE html>/);
    expect(html).toContain('<html lang="de"');
    expect(html).toMatch(/<meta name="color-scheme" content="light"\s*\/?>/);
    expect(html).not.toMatch(/<(link|script)\b/i);
    expect(html).not.toMatch(/var\(--/);
    expect(html).not.toMatch(/display:\s*(flex|grid)/);
    expect(html).toContain("<!--[if mso]>");
  });

  it("keeps only the media query in the style block and avoids unsupported properties", () => {
    const { html } = renderMagicLinkEmail("signup", url);
    const style = html.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? "";
    expect(style).toContain("@media");
    expect(style).not.toMatch(/\b(body|table|img)\s*\{/);
    expect(html).not.toContain("outline");
    expect(html).not.toContain("-ms-interpolation-mode");
    expect(html).not.toContain("overflow");
    expect(html).not.toContain("max-height");
  });

  it("applies the button radius once, on the cell", () => {
    const { html } = renderMagicLinkEmail("signup", url);
    expect(html.match(/border-radius/g)).toHaveLength(1);
  });

  it("ships the logo without an alpha channel", () => {
    const { attachments } = renderMagicLinkEmail("signup", url);
    // IHDR colour type 2 is RGB, so no transparent pixels can turn black on a dark background.
    expect(attachments[0]!.content.readUInt8(25)).toBe(2);
  });

  it("embeds the logo inline with alt text and omits footer links without a target", () => {
    const { html, text, attachments } = renderMagicLinkEmail("signup", url);
    const [logo] = attachments;
    expect(html).toContain(`src="cid:${logo!.cid}"`);
    expect(html).toContain('alt="Bundesministerium der Justiz und für Verbraucherschutz"');
    expect(logo).toMatchObject({ contentType: "image/png", contentDisposition: "inline" });
    expect(logo!.content.subarray(1, 4).toString()).toBe("PNG");
    expect(html).not.toContain('href="#"');
    expect(text).not.toContain("An Befragungen teilnehmen");
    expect(html).toContain("Open Source Code");
  });
});
