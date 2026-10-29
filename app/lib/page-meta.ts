import { BASE_PATH } from "~/lib/base-path";

export const PAGE_TITLE = "Verhandlungstermin-Finder | Justiz-Services";

export const PAGE_DESCRIPTION =
  "Der Verhandlungstermin-Finder vereinfacht die Terminkoordination. Gerichte starten die Terminumfrage, Beteiligte teilen ihre Verfügbarkeiten und der passende Termin wird gewählt.";

// Link previews need an absolute image URL, so the meta tags are built from the public origin.
export function pageMeta(baseUrl: string) {
  return [
    { name: "description", content: PAGE_DESCRIPTION },
    { property: "og:title", content: PAGE_TITLE },
    { property: "og:description", content: PAGE_DESCRIPTION },
    { property: "og:type", content: "website" },
    { property: "og:image", content: `${baseUrl}${BASE_PATH}/og-image.png` },
  ];
}
