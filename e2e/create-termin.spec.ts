import type { Page } from "@playwright/test";
import type { Kysely } from "kysely";

import type { Database } from "../app/database/types.ts";
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

let judgeId: string;

async function slotCount(db: Kysely<Database>, appointmentId: string) {
  const { count } = await db
    .selectFrom("time_slot")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("appointment_id", "=", appointmentId)
    .executeTakeFirstOrThrow();
  return Number(count);
}

const appointmentId = (page: Page) => new URL(page.url()).pathname.split("/")[2]!;

test.beforeEach(async ({ page, users }) => {
  const judge = await users.create({ roles: ["richter"] });
  judgeId = judge.id;
  await signIn(page, judge);
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

test("a richter creates a Terminumfrage with four time slots next week", async ({ page, db }) => {
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");

  // The page starts with three rows; add a fourth.
  await expect(page.getByRole("group", { name: /^Zeitfenster \d+$/ })).toHaveCount(3);
  await page.getByRole("button", { name: "Zeitfenster hinzufügen" }).click();
  await expect(page.getByRole("group", { name: /^Zeitfenster \d+$/ })).toHaveCount(4);

  for (const [index, window] of nextWeek.entries()) {
    await fillWindow(page, index + 1, window);
  }
  await page.getByRole("button", { name: "Weiter" }).click();

  // The appointment is in the database as a draft, and its id is in the URL of the review.
  await expect(page).toHaveURL(/\/overview\/[^/]+\/confirm$/);
  const id = appointmentId(page);
  const draft = await db
    .selectFrom("appointment")
    .select(["aktenzeichen", "status", "user_id"])
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  expect(draft).toEqual({ aktenzeichen: "574 C 65412/26", status: "draft", user_id: judgeId });
  expect(await slotCount(db, id)).toBe(4);

  // The review is read from the database, so it survives a reload and lists every window.
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Bitte überprüfen Sie Ihre Angaben" }),
  ).toBeVisible();
  const windows = page.getByRole("group", { name: "Zeitfenster", exact: true });
  await expect(windows.getByText(/^\d{2}:\d{2} – \d{2}:\d{2}$/)).toHaveText([
    "09:00 – 10:30",
    "11:00 – 12:00",
    "13:30 – 15:00",
    "16:00 – 17:15",
  ]);
  await expect(
    page.getByRole("group", { name: "Verhandlungsdaten", exact: true }).getByText("574 C 65412/26"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Terminumfrage erstellen" }).click();

  await expect(page).toHaveURL(new RegExp(`/overview/${id}/created$`));
  await expect(
    page.getByRole("heading", { name: "Sie haben die Terminumfrage erstellt." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nächste Schritte" })).toBeVisible();
  await expect(page.getByText(`/umfrage/${id}`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Link zur Terminumfrage kopieren" })).toBeVisible();

  await page.getByRole("link", { name: "Zu den Terminumfragen" }).click();
  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByRole("heading", { name: "Übersicht" })).toBeAttached();
  const { status } = await db
    .selectFrom("appointment")
    .select("status")
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  expect(status).toBe("open");
});

test("going back from the review keeps what was entered and updates the same draft", async ({
  page,
  db,
}) => {
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");
  await fillWindow(page, 1, nextWeek[0]!);
  await fillWindow(page, 2, nextWeek[1]!);
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(
    page.getByRole("heading", { name: "Bitte überprüfen Sie Ihre Angaben" }),
  ).toBeVisible();
  const id = appointmentId(page);

  await page.getByRole("button", { name: "Zurück" }).click();

  await expect(page).toHaveURL(new RegExp(`/overview/new\\?entwurf=${id}$`));
  await expect(page.getByRole("textbox", { name: "Aktenzeichen" })).toHaveValue("574 C 65412/26");
  await expect(windowRow(page, 2).getByRole("textbox", { name: "Stunde" }).first()).toHaveValue(
    "11",
  );
  await expect(page.getByRole("alert")).toHaveCount(0);

  // Changing the Aktenzeichen and saving again edits the draft instead of creating a second one.
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 99999/26");
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page).toHaveURL(new RegExp(`/overview/${id}/confirm$`));
  await expect(page.getByText("574 C 99999/26")).toBeVisible();
  const drafts = await db
    .selectFrom("appointment")
    .select(["id", "aktenzeichen", "status"])
    .where("user_id", "=", judgeId)
    .execute();
  expect(drafts).toEqual([{ id, aktenzeichen: "574 C 99999/26", status: "draft" }]);
  expect(await slotCount(db, id)).toBe(2);
});

test("a draft is only visible to the richter who created it", async ({ page, users }) => {
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");
  await fillWindow(page, 1, nextWeek[0]!);
  await fillWindow(page, 2, nextWeek[1]!);
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page).toHaveURL(/\/overview\/[^/]+\/confirm$/);
  const confirmPath = new URL(page.url()).pathname;

  await page.context().clearCookies();
  await signIn(page, await users.create({ roles: ["richter"] }));
  const response = await page.goto(confirmPath);

  expect(response?.status()).toBe(404);
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
