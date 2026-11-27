import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import SVGtoPDF from "svg-to-pdfkit";

import logoSvg from "../../components/shared/bmjv-logo-light.svg?raw";
import type { Slot } from "../../core/domain/availability.ts";
import { formatRange } from "../../core/domain/time/format.ts";
import { PRODUCT_NAME } from "../web/page-meta.ts";
// KERN's Fira Sans as TrueType: PDF cannot embed the WOFF2 files KERN ships (see fonts/OFL.txt).
// Vite inlines them into the bundle as data URLs, so rendering does not read files at runtime.
import fontRegular from "./fonts/FiraSans-Regular.ttf?inline";
import fontBold from "./fonts/FiraSans-SemiBold.ttf?inline";

export const TITLE = "Einladung zur Terminumfrage";
export const HEADING =
  "Sie sind eingeladen, Ihre Verfügbarkeit für einen Verhandlungstermin anzugeben.";
export const DESCRIPTION = `Bitte geben Sie im ${PRODUCT_NAME} an, zu welchen Zeitfenstern Sie teilnehmen können. Öffnen Sie dazu den folgenden Link oder scannen Sie den QR-Code mit Ihrem Smartphone.`;
export const LINK_HINT =
  "Der Link ist persönlich. Bitte leiten Sie ihn nicht weiter, Sie können nur einmal antworten.";
export const NO_REPLY =
  "Bitte antworten Sie nicht über den elektronischen Rechtsverkehr (ERV) auf diese Nachricht. Antworten über das ERV können nicht berücksichtigt werden. Geben Sie Ihre Verfügbarkeit ausschließlich über den Link an.";
export const LOGO_ALT = "Bundesministerium der Justiz und für Verbraucherschutz";
export const QR_ALT = "QR-Code mit dem Link zur Terminumfrage";

export type ErvInvitationPdf = {
  aktenzeichen: string;
  // The name of the court. Older Terminumfragen have none.
  court: string | null;
  // The guest's name, if the judge gave one. Never the SAFE-ID or e-mail address.
  name: string | null;
  slots: Slot[];
  surveyUrl: string;
};

// KERN colours, as in the e-mails.
const COLOR = {
  text: "#131525",
  muted: "#51577a",
  action: "#2044aa",
  border: "#c0c3d5",
  noteBackground: "#f2f3f7",
};

// A4 in points, with 20 mm margins.
const MARGIN = 57;
const MM = 72 / 25.4;
const LOGO_WIDTH = 50 * MM;
const QR_SIZE = 40 * MM;
const GAP = 16;

const fontData = (dataUrl: string) =>
  Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");

type Square = { x: number; y: number; size: number };

// The dark squares of a QR code of the URL, `size` wide including the quiet zone of four modules
// around it. Drawn as vector squares, the code stays sharp at any print size.
export function qrCodeSquares(url: string, size: number): Square[] {
  const { modules } = QRCode.create(url, { errorCorrectionLevel: "M" });
  const cell = size / (modules.size + 8);
  const squares: Square[] = [];
  for (let row = 0; row < modules.size; row++) {
    for (let col = 0; col < modules.size; col++) {
      if (modules.get(row, col))
        squares.push({ x: (col + 4) * cell, y: (row + 4) * cell, size: cell });
    }
  }
  return squares;
}

function drawQrCode(doc: PDFKit.PDFDocument, url: string, x: number, y: number) {
  for (const square of qrCodeSquares(url, QR_SIZE)) {
    doc.rect(x + square.x, y + square.y, square.size, square.size);
  }
  doc.fillColor(COLOR.text).fill();
}

// The invitation a judge sends a guest through the ERV, as a one-page PDF/A-2b with the personal
// survey link and a QR code of it. The ERV only accepts documents with embedded fonts, so the page
// uses KERN's Fira Sans and none of the standard PDF fonts.
export function renderErvInvitationPdf({
  aktenzeichen,
  court,
  name,
  slots,
  surveyUrl,
}: ErvInvitationPdf): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    // No standard font: PDF/A requires every font to be embedded.
    font: null as unknown as string,
    subset: "PDF/A-2b",
    pdfVersion: "1.7",
    tagged: true,
    displayTitle: true,
    lang: "de-DE",
    info: { Title: TITLE, Subject: `Aktenzeichen ${aktenzeichen}`, Author: PRODUCT_NAME },
  });
  doc.registerFont("regular", fontData(fontRegular));
  doc.registerFont("bold", fontData(fontBold));

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  const left = MARGIN;
  const width = doc.page.width - 2 * MARGIN;
  const root = doc.struct("Document");
  doc.addStructure(root);
  const add = (type: string, draw: () => void, options: { alt?: string } = {}) =>
    root.add(doc.struct(type, options, draw));
  const text = (value: string, font: "regular" | "bold", size: number, color = COLOR.text) =>
    doc.font(font).fontSize(size).fillColor(color).text(value, { width, lineGap: 3 });

  // Header: logo and product name, as in the e-mails.
  const top = doc.y;
  add("Figure", () => SVGtoPDF(doc, logoSvg, left, top, { width: LOGO_WIDTH }), { alt: LOGO_ALT });
  doc.y = top + LOGO_WIDTH * (82 / 178) + 12;
  add("P", () => text(PRODUCT_NAME, "bold", 16));
  doc.markContent("Artifact");
  doc
    .moveTo(left, doc.y + 12)
    .lineTo(left + width, doc.y + 12)
    .lineWidth(1)
    .strokeColor(COLOR.border)
    .stroke();
  doc.endMarkedContent();
  doc.y += 32;

  add("H1", () => text(HEADING, "bold", 18));
  doc.moveDown(0.8);
  if (name) add("P", () => text(`Für: ${name}`, "regular", 12));
  add("P", () => text(`Aktenzeichen: ${aktenzeichen}`, "regular", 12));
  if (court) add("P", () => text(`Gericht: ${court}`, "regular", 12));
  doc.moveDown(0.8);
  add("P", () => text("Vorgeschlagene Zeitfenster:", "bold", 12));
  const list = doc.struct("L");
  root.add(list);
  doc
    .font("regular")
    .fontSize(12)
    .fillColor(COLOR.text)
    .list(
      slots.map((slot) => formatRange(slot)),
      { width, lineGap: 3, bulletRadius: 2, structParent: list },
    );
  list.end();
  doc.moveDown(1.2);

  add("P", () => text(DESCRIPTION, "regular", 12));
  doc.moveDown(1);

  // The link next to the QR code, both opening the personal survey.
  const blockTop = doc.y;
  const linkWidth = width - QR_SIZE - GAP;
  add("P", () =>
    doc
      .font("bold")
      .fontSize(12)
      .fillColor(COLOR.text)
      .text("Zur Terminumfrage:", left, blockTop, { width: linkWidth }),
  );
  doc.moveDown(0.3);
  add("Link", () =>
    doc
      .font("regular")
      .fontSize(12)
      .fillColor(COLOR.action)
      .text(surveyUrl, { width: linkWidth, link: surveyUrl, underline: true, lineGap: 3 }),
  );
  const linkBottom = doc.y;
  add("Figure", () => drawQrCode(doc, surveyUrl, left + width - QR_SIZE, blockTop), {
    alt: QR_ALT,
  });
  doc.x = left;
  doc.y = Math.max(linkBottom, blockTop + QR_SIZE) + GAP;

  add("P", () => text(LINK_HINT, "regular", 12, COLOR.muted));
  doc.moveDown(1.5);

  // The note that the ERV is a one-way channel here, set apart in a box.
  const padding = 12;
  const noteWidth = width - 2 * padding;
  doc.font("bold").fontSize(12);
  const noteHeight = doc.heightOfString(NO_REPLY, { width: noteWidth, lineGap: 3 });
  const noteTop = doc.y;
  doc.markContent("Artifact");
  doc
    .rect(left, noteTop, width, noteHeight + 2 * padding)
    .fillColor(COLOR.noteBackground)
    .fill();
  doc
    .rect(left, noteTop, 4, noteHeight + 2 * padding)
    .fillColor(COLOR.action)
    .fill();
  doc.endMarkedContent();
  add("P", () =>
    doc
      .font("bold")
      .fontSize(12)
      .fillColor(COLOR.text)
      .text(NO_REPLY, left + padding, noteTop + padding, { width: noteWidth, lineGap: 3 }),
  );

  root.end();
  doc.end();
  return done;
}
