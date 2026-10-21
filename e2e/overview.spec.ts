import { expect, signIn, test } from "./fixtures.ts";

test("overview lists the termin surveys with their status", async ({ page, users }) => {
  await signIn(page, await users.create());
  await page.goto("/overview");

  await expect(page.getByRole("heading", { name: "Übersicht" })).toBeAttached();
  await expect(page.getByRole("button", { name: "Terminumfrage erstellen" })).toBeVisible();
  await expect(page.locator("tbody tr")).toHaveCount(4);
  await expect(
    page.getByRole("row", {
      name: /574 C 65412\/26.*Termin ist Montag, 9\. November 2026 um 15:30/,
    }),
  ).toBeVisible();
});
