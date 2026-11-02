import { BASE_PATH, expect, test } from "./fixtures.ts";

const HEADING = "Die Terminumfrage konnte nicht gefunden werden";

test("an unknown address answers 404 and explains it", async ({ page }) => {
  const response = await page.goto(`${BASE_PATH}/does-not-exist`);

  expect(response?.status()).toBe(404);
  await expect(page).toHaveTitle(
    "Terminumfrage nicht gefunden – Verhandlungstermin-Finder – Justiz-Services",
  );
  await expect(page.getByText("404", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1, name: HEADING })).toBeVisible();
  await expect(page.getByText("überprüfen Sie die Schreibweise.")).toBeVisible();
});

test("an unknown survey link shows the same page", async ({ page }) => {
  const response = await page.goto(`${BASE_PATH}/umfrage/00000000-0000-4000-8000-000000000000`);

  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1, name: HEADING })).toBeVisible();
});

test("a found page keeps the service title", async ({ page }) => {
  const response = await page.goto(`${BASE_PATH}/`);

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Verhandlungstermin-Finder | Justiz-Services");
  await expect(page.getByText(HEADING)).toHaveCount(0);
});
