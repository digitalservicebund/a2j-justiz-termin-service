// svg-to-pdfkit ships without types. Only the call this app makes is declared.
declare module "svg-to-pdfkit" {
  export default function SVGtoPDF(
    doc: PDFKit.PDFDocument,
    svg: string,
    x: number,
    y: number,
    options?: { width?: number; height?: number },
  ): void;
}
