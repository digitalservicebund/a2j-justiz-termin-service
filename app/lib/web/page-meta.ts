import { BASE_PATH } from "./base-path.ts";

// The name of the service in pages, mails and calendars.
export const PRODUCT_NAME = "Verhandlungstermin-Finder";

export const PAGE_TITLE = `${PRODUCT_NAME} | Justiz-Services`;

export const PAGE_DESCRIPTION =
  "Der Verhandlungstermin-Finder vereinfacht die Terminkoordination. Gerichte starten die Terminumfrage, Beteiligte teilen ihre Verfügbarkeiten und der passende Termin wird gewählt.";

// Link previews need an absolute image URL, so the meta tags are built from the public origin.
export function pageMeta(baseUrl: string) {
  return [
    { name: "description", content: PAGE_DESCRIPTION },
    // Keep in line with the X-Robots-Tag header in server.js, which also covers non-HTML responses.
    { name: "robots", content: "noindex, nofollow" },
    { property: "og:title", content: PAGE_TITLE },
    { property: "og:description", content: PAGE_DESCRIPTION },
    { property: "og:type", content: "website" },
    { property: "og:image", content: `${baseUrl}${BASE_PATH}/og-image.png` },
  ];
}
