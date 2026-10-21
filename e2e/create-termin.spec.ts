import type { Page } from "@playwright/test";

import { expect, signIn, test } from "./fixtures.ts";

const TOO_FEW = "Geben Sie mindestens zwei Zeitfenster an.";

// Dates relative to today so the "no past dates" rule never makes this test age badly.
function inDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return {
    day: String(date.getDate()),
    month: String(date.getMonth() + 1),
    year: String(date.getFullYear()),
  };
}

type Window = { daysFromToday: number; start: [string, string]; end: [string, string] };

// Four different windows spread over next week.
const nextWeek: Window[] = [
  { daysFromToday: 7, start: ["9", "0"], end: ["10", "30"] },
  { daysFromToday: 8, start: ["11", "0"], end: ["12", "0"] },
  { daysFromToday: 9, start: ["13", "30"], end: ["15", "0"] },
  { daysFromToday: 10, start: ["16", "0"], end: ["17", "15"] },
];

test.beforeEach(async ({ page, users }) => {
  await signIn(page, await users.create({ roles: ["richter"] }));
  await page.goto("/overview/new");
  await expect(page.getByRole("heading", { name: "Verhandlungsdaten" })).toBeVisible();
});

function windowRow(page: Page, number: number) {
  return page.getByRole("group", { name: `Zeitfenster ${number}`, exact: true });
}

async function fillWindow(page: Page, number: number, window: Window) {
  const row = windowRow(page, number);
  const { day, month, year } = inDays(window.daysFromToday);
  await row.getByRole("textbox", { name: "Tag" }).fill(day);
  await row.getByRole("textbox", { name: "Monat" }).fill(month);
  await row.getByRole("textbox", { name: "Jahr" }).fill(year);
  await row.getByRole("textbox", { name: "Stunde" }).first().fill(window.start[0]);
  await row.getByRole("textbox", { name: "Minute" }).first().fill(window.start[1]);
  await row.getByRole("textbox", { name: "Stunde" }).last().fill(window.end[0]);
  await row.getByRole("textbox", { name: "Minute" }).last().fill(window.end[1]);
}

test("a richter creates a Terminumfrage with four time slots next week", async ({ page }) => {
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");

  // The page starts with three rows; add a fourth.
  await expect(page.getByRole("group", { name: /^Zeitfenster \d+$/ })).toHaveCount(3);
  await page.getByRole("button", { name: "Zeitfenster hinzufügen" }).click();
  await expect(page.getByRole("group", { name: /^Zeitfenster \d+$/ })).toHaveCount(4);

  for (const [index, window] of nextWeek.entries()) {
    await fillWindow(page, index + 1, window);
  }
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole("heading", { name: "Übersicht" })).toBeAttached();
});

test("the form shows what is missing and keeps what was typed", async ({ page }) => {
  await page.getByRole("button", { name: "Weiter" }).click();

  const aktenzeichen = page.getByRole("textbox", { name: "Aktenzeichen" });
  await expect(page.getByText("Geben Sie ein Aktenzeichen an.")).toBeVisible();
  await expect(page.getByText(TOO_FEW)).toBeVisible();
  await expect(aktenzeichen).toBeFocused();
  await expect(page).toHaveURL(/\/overview\/new$/);

  // Fixing the Aktenzeichen clears its error right away; the other one stays.
  await aktenzeichen.fill("574 C 65412/26");
  await expect(page.getByText("Geben Sie ein Aktenzeichen an.")).toBeHidden();
  await expect(page.getByText(TOO_FEW)).toBeVisible();
});

test("one time slot is not enough", async ({ page }) => {
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");
  await fillWindow(page, 1, nextWeek[0]!);

  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page.getByText(TOO_FEW)).toBeVisible();
  await expect(page.getByRole("button", { name: "Zeitfenster hinzufügen" })).toBeFocused();

  // A second valid window resolves the error without another submit.
  await fillWindow(page, 2, nextWeek[1]!);
  await expect(page.getByText(TOO_FEW)).toBeHidden();
});

test("a window with a problem is flagged in place", async ({ page }) => {
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");
  await fillWindow(page, 1, nextWeek[0]!);
  await fillWindow(page, 2, { ...nextWeek[1]!, end: ["10", "0"] });

  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(
    windowRow(page, 2).getByText("Die Endzeit muss nach der Startzeit liegen."),
  ).toBeVisible();
  await expect(windowRow(page, 1).getByRole("alert")).toHaveCount(0);
  await expect(page).toHaveURL(/\/overview\/new$/);
});

test("rows cannot be removed below two", async ({ page }) => {
  const rows = page.getByRole("group", { name: /^Zeitfenster \d+$/ });
  await expect(rows).toHaveCount(3);

  await page.getByRole("button", { name: "Zeitfenster 1 entfernen" }).click();
  await expect(rows).toHaveCount(2);
  await expect(page.getByText(TOO_FEW)).toBeHidden();

  await page.getByRole("button", { name: "Zeitfenster 1 entfernen" }).click();
  await expect(rows).toHaveCount(2);
  await expect(page.getByText(TOO_FEW)).toBeVisible();
});

test("only a richter can open the page", async ({ page, users }) => {
  await page.context().clearCookies();
  await signIn(page, await users.create({ roles: ["klaeger"] }));

  const response = await page.goto("/overview/new");

  expect(response?.status()).toBe(403);
});
