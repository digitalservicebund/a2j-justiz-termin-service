// @vitest-environment node
import jsQR from "jsqr";
import { extractLinks, extractText, getDocumentProxy, getMeta } from "unpdf";
import { describe, expect, it } from "vitest";

import {
  DESCRIPTION,
  HEADING,
  LINK_HINT,
  NO_REPLY,
  qrCodeSquares,
  renderErvInvitationPdf,
  type ErvInvitationPdf,
} from "./erv-invitation-pdf.ts";

const surveyUrl = "http://localhost:3000/verhandlungstermin-finder/umfrage/tok-1";

// 09:00 to 10:30 Berlin time in summer.
const invitation: ErvInvitationPdf = {
  aktenzeichen: "574 C 7/26",
  name: "Person A",
  slots: [
    { id: "s1", start: new Date("2026-09-17T07:00:00Z"), end: new Date("2026-09-17T08:30:00Z") },
  ],
  surveyUrl,
};

async function render(overrides: Partial<ErvInvitationPdf> = {}) {
  const pdf = await renderErvInvitationPdf({ ...invitation, ...overrides });
  const doc = await getDocumentProxy(new Uint8Array(pdf));
  const { text } = await extractText(doc, { mergePages: true });
  // pdf.js puts line breaks where the PDF wraps a paragraph.
  return { pdf, doc, text: text.replaceAll(/\s+/g, " ") };
}

describe("renderErvInvitationPdf", () => {
  it("renders one page with the invitation's texts", async () => {
    const { doc, text } = await render();

    expect(doc.numPages).toBe(1);
    for (const expected of [
      "Verhandlungstermin-Finder",
      HEADING,
      "Für: Person A",
      "Aktenzeichen: 574 C 7/26",
      "Vorgeschlagene Zeitfenster:",
      "Donnerstag, 17.09.2026, 09:00 bis 10:30 Uhr",
      DESCRIPTION,
      LINK_HINT,
      NO_REPLY,
    ]) {
      expect(text).toContain(expected);
    }
  });

  it("links the printed survey URL", async () => {
    const { doc, text } = await render();

    // A long URL wraps over lines.
    expect(text.replaceAll(" ", "")).toContain(surveyUrl);
    const { links } = await extractLinks(doc);
    // One link annotation per line of the URL.
    expect(new Set(links.flat())).toEqual(new Set([surveyUrl]));
  });

  it("leaves out the name line when the guest has no name", async () => {
    const { text } = await render({ name: null });

    expect(text).not.toContain("Für:");
  });

  it("is a tagged PDF/A-2b in German with its title", async () => {
    const { pdf, doc } = await render();

    const { info, metadata } = await getMeta(doc);
    expect(info.Title).toBe("Einladung zur Terminumfrage");
    expect(metadata?.get("pdfaid:part")).toBe("2");
    expect(metadata?.get("pdfaid:conformance")).toBe("B");
    const raw = pdf.toString("latin1");
    expect(raw).toContain("/MarkInfo");
    expect(raw).toContain("/Lang (de-DE)");
  });

  it("embeds Fira Sans and no standard font", async () => {
    const { pdf } = await render();

    const raw = pdf.toString("latin1");
    expect(raw).toMatch(/\/FontFile2/);
    expect(raw).toMatch(/FiraSans-Regular/);
    expect(raw).not.toMatch(/\/BaseFont \/Helvetica/);
  });
});

// Paints the squares black on white, as a phone camera would see the printed code.
function scan(url: string) {
  const size = 200;
  const pixels = new Uint8ClampedArray(size * size * 4).fill(255);
  for (const square of qrCodeSquares(url, size)) {
    for (let y = Math.round(square.y); y < Math.round(square.y + square.size); y++) {
      for (let x = Math.round(square.x); x < Math.round(square.x + square.size); x++) {
        pixels.fill(0, (y * size + x) * 4, (y * size + x) * 4 + 3);
      }
    }
  }
  return jsQR(pixels, size, size)?.data;
}

describe("qrCodeSquares", () => {
  it("draws a QR code that scans as the survey URL", () => {
    expect(scan(surveyUrl)).toBe(surveyUrl);
  });

  it("keeps a quiet zone of four modules inside the given size", () => {
    const squares = qrCodeSquares(surveyUrl, 200);
    const cell = squares[0]!.size;

    expect(Math.min(...squares.map((s) => s.x))).toBeCloseTo(4 * cell);
    expect(Math.max(...squares.map((s) => s.x + s.size))).toBeCloseTo(200 - 4 * cell);
  });
});
