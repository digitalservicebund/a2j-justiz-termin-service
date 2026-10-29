import { describe, expect, it } from "vitest";

import { PAGE_DESCRIPTION, PAGE_TITLE, pageMeta } from "../page-meta";

describe("pageMeta", () => {
  it("describes the page for search engines and link previews", () => {
    expect(pageMeta("https://app.example.com")).toEqual([
      { name: "description", content: PAGE_DESCRIPTION },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: PAGE_TITLE },
      { property: "og:description", content: PAGE_DESCRIPTION },
      { property: "og:type", content: "website" },
      {
        property: "og:image",
        content: "https://app.example.com/verhandlungstermin-finder/og-image.png",
      },
    ]);
  });
});
