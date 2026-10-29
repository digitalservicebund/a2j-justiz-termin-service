import { baseURL, expect, test } from "./fixtures.ts";

test("front page shows the login, the language links and the process steps", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Verhandlungstermin-Finder" }),
  ).toBeVisible();
  await expect(page.getByLabel("E-Mail-Adresse")).toBeVisible();

  const languages = page.getByRole("navigation", { name: "Sprachangebote" });
  await expect(languages.getByRole("link", { name: "Leichte Sprache" })).toHaveAttribute(
    "href",
    "https://service.justiz.de/leichtesprache",
  );
  await expect(languages.getByRole("link", { name: "Gebärdensprache" })).toHaveAttribute(
    "href",
    "https://service.justiz.de/gebaerdensprache",
  );

  const breadcrumb = page.getByRole("navigation", { name: "Brotkrumen" });
  await expect(breadcrumb.getByText("Verhandlungstermin-Finder")).toBeVisible();
  await expect(breadcrumb.getByText("Übersicht")).toHaveCount(0);

  const steps = page.getByRole("heading", { name: "Der Ablauf" }).locator("xpath=..");
  await expect(steps.getByRole("listitem")).toHaveText([
    "Das Gericht erstellt die Terminumfrage",
    "Verfahrensbeteiligte teilen ihre Verfügbarkeit",
    "Das Gericht wählt einen passenden Termin aus",
    "Die Servicestelle verschickt die Ladung",
  ]);

  await expect(page.getByText("Hat Ihnen diese Seite geholfen?")).toHaveCount(0);
});

test("the pilot notice is collapsed until opened", async ({ page }) => {
  await page.goto("/");

  const notice = page.getByText("Verfahrensbeteiligte können den Onlinedienst aktuell nur");
  await expect(notice).toBeHidden();
  await page.getByText("Der Onlinedienst befindet sich in der Testphase (Pilotprojekt)").click();
  await expect(notice).toBeVisible();
});

test("an unknown address is told about the pilot instead of receiving a link", async ({ page }) => {
  await page.goto("/");

  await page.getByLabel("E-Mail-Adresse").fill("person.z@example.com");
  await page.getByRole("button", { name: "Anmelden" }).click();

  await expect(
    page.getByText("Während der Pilotierung können nur ausgewählte Gerichte"),
  ).toBeVisible();
});

test("front page has the meta tags for search engines and link previews", async ({
  page,
  request,
}) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Verhandlungstermin-Finder | Justiz-Services");
  const description = page.locator('meta[name="description"]');
  await expect(description).toHaveAttribute("content", /^Der Verhandlungstermin-Finder/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Verhandlungstermin-Finder | Justiz-Services",
  );
  await expect(page.locator('meta[property="og:description"]')).toHaveAttribute(
    "content",
    (await description.getAttribute("content")) ?? "",
  );
  await expect(page.locator('meta[property="og:type"]')).toHaveAttribute("content", "website");

  const image = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(image).toBe(`${baseURL}/og-image.png`);
  const response = await request.get(image ?? "");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
});
