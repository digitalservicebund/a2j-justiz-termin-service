import type { Page } from "@playwright/test";
import type { Kysely } from "kysely";

import type { Database } from "../app/database/types.ts";
import { expect, signIn, test } from "./fixtures.ts";

const TOO_FEW = "Geben Sie mindestens zwei Zeitfenster an.";

// Dates relative to today so the "no past dates" rule never makes this test age badly.
function inDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}`;
}

type Window = { daysFromToday: number; start: string; end: string };

// Four different windows spread over next week.
const nextWeek: Window[] = [
  { daysFromToday: 7, start: "9:00", end: "10:30" },
  { daysFromToday: 8, start: "11:00", end: "12:00" },
  { daysFromToday: 9, start: "13:30", end: "15:00" },
  { daysFromToday: 10, start: "16:00", end: "17:15" },
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

const addArea = (page: Page) => page.getByRole("region", { name: "Zeitfenster hinzufügen" });

// Adds windows through the add area: the dates, typed as the user would, and one time range.
async function addWindows(page: Page, dates: string, start: string, end: string) {
  const area = addArea(page);
  await area.getByRole("textbox", { name: "Datum" }).fill(dates);
  await area.getByRole("textbox", { name: "Beginn" }).fill(start);
  await area.getByRole("textbox", { name: "Ende" }).fill(end);
  await area.getByRole("button", { name: "Zeitfenster hinzufügen" }).click();
}

const addWindow = (page: Page, window: Window) =>
  addWindows(page, inDays(window.daysFromToday), window.start, window.end);

test("a richter creates a Terminumfrage with four time slots next week", async ({ page, db }) => {
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");

  // The page starts without any window.
  await expect(page.getByRole("group", { name: /^Zeitfenster \d+$/ })).toHaveCount(0);

  for (const window of nextWeek) await addWindow(page, window);
  await expect(page.getByRole("group", { name: /^Zeitfenster \d+$/ })).toHaveCount(4);
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
  // Publishing issues the token of the universal survey link, which is not the appointment id.
  const { universal_token } = await db
    .selectFrom("appointment")
    .select("universal_token")
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  expect(universal_token).toBeTruthy();
  await expect(page.getByText(`/umfrage/${universal_token}`)).toBeVisible();
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
  await addWindow(page, nextWeek[0]!);
  await addWindow(page, nextWeek[1]!);
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(
    page.getByRole("heading", { name: "Bitte überprüfen Sie Ihre Angaben" }),
  ).toBeVisible();
  const id = appointmentId(page);

  await page.getByRole("button", { name: "Zurück" }).click();

  await expect(page).toHaveURL(new RegExp(`/overview/new\\?entwurf=${id}$`));
  await expect(page.getByRole("textbox", { name: "Aktenzeichen" })).toHaveValue("574 C 65412/26");
  await expect(windowRow(page, 2).getByRole("textbox", { name: "Beginn" })).toHaveValue("11:00");
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
  await addWindow(page, nextWeek[0]!);
  await addWindow(page, nextWeek[1]!);
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
  await addWindow(page, nextWeek[0]!);

  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page.getByText(TOO_FEW)).toBeVisible();
  await expect(addArea(page).getByRole("textbox", { name: "Datum" })).toBeFocused();

  // A second valid window resolves the error without another submit.
  await addWindow(page, nextWeek[1]!);
  await expect(page.getByText(TOO_FEW)).toBeHidden();
});

test("a window with a problem is flagged in place", async ({ page }) => {
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");
  await addWindow(page, nextWeek[0]!);
  await addWindow(page, nextWeek[1]!);
  await windowRow(page, 2).getByRole("textbox", { name: "Ende" }).fill("10:00");

  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(
    windowRow(page, 2).getByText("Die Endzeit muss nach der Startzeit liegen."),
  ).toBeVisible();
  await expect(windowRow(page, 1).getByRole("alert")).toHaveCount(0);
  await expect(page).toHaveURL(/\/overview\/new$/);
});

test("windows can be removed, and the form still asks for two", async ({ page }) => {
  const windows = page.getByRole("group", { name: /^Zeitfenster \d+$/ });
  await addWindows(page, `${inDays(7)}, ${inDays(8)}, ${inDays(9)}`, "9", "10");
  await expect(windows).toHaveCount(3);

  await page.getByRole("button", { name: "Zeitfenster 1 entfernen" }).click();
  await expect(windows).toHaveCount(2);
  await expect(windowRow(page, 1).getByRole("textbox", { name: "Datum" })).toBeFocused();

  await page.getByRole("button", { name: "Zeitfenster 1 entfernen" }).click();
  await expect(windows).toHaveCount(1);

  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByText(TOO_FEW)).toBeVisible();
});

test("one time range for several dates, entered with the keyboard only", async ({ page }) => {
  const area = addArea(page);
  await area.getByRole("textbox", { name: "Beginn" }).fill("9-11");
  await area.getByRole("textbox", { name: "Datum" }).click();
  // Leaving the start field read the range into both times.
  await expect(area.getByRole("textbox", { name: "Ende" })).toHaveValue("11:00");

  await page.keyboard.type(`${inDays(7)},${inDays(8)},`);
  await expect(
    page.getByRole("list", { name: "Ausgewählte Daten" }).getByRole("listitem"),
  ).toHaveCount(2);
  // Enter with nothing left to type adds the windows; it does not submit the form.
  await page.keyboard.press("Enter");

  const windows = page.getByRole("group", { name: /^Zeitfenster \d+$/ });
  await expect(windows).toHaveCount(2);
  await expect(windowRow(page, 1).getByRole("textbox", { name: "Beginn" })).toHaveValue("09:00");
  await expect(windowRow(page, 2).getByRole("textbox", { name: "Ende" })).toHaveValue("11:00");
  await expect(page).toHaveURL(/\/overview\/new$/);
  await expect(page.getByRole("status")).toHaveText("2 Zeitfenster hinzugefügt");
  // The next working day is offered, selected, so the next round can start typing right away.
  await expect(area.getByRole("textbox", { name: "Datum" })).toBeFocused();
  await expect(area.getByRole("textbox", { name: "Datum" })).not.toHaveValue("");
});

test("the end can be given as a length", async ({ page }) => {
  await addWindows(page, inDays(7), "13:30", "+90min");

  await expect(windowRow(page, 1).getByRole("textbox", { name: "Ende" })).toHaveValue("15:00");
});

test("days are picked in the calendar", async ({ page }) => {
  const area = addArea(page);
  await area.getByRole("button", { name: "Kalender öffnen" }).click();
  await area.getByRole("button", { name: "Nächster Monat" }).click();
  await area.getByRole("button", { name: /, 14\. / }).click();
  await area.getByRole("button", { name: /, 15\. / }).click();
  await expect(
    page.getByRole("list", { name: "Ausgewählte Daten" }).getByRole("listitem"),
  ).toHaveCount(2);

  await area.getByRole("textbox", { name: "Beginn" }).fill("9");
  await area.getByRole("textbox", { name: "Ende" }).fill("10");
  await area.getByRole("button", { name: "Zeitfenster hinzufügen" }).click();

  await expect(page.getByRole("group", { name: /^Zeitfenster \d+$/ })).toHaveCount(2);
  await expect(windowRow(page, 1).getByRole("textbox", { name: "Datum" })).toHaveValue(/^14\./);
  await expect(windowRow(page, 2).getByRole("textbox", { name: "Datum" })).toHaveValue(/^15\./);
});

test("what cannot be added is said, and an overlap is flagged right away", async ({ page }) => {
  await addWindows(page, inDays(7), "9", "10");

  await addWindows(page, `${inDays(7)}, 1.1.2020`, "9", "10");
  await expect(page.getByRole("status")).toHaveText(
    "Kein Zeitfenster hinzugefügt, 2 übersprungen (Datum in der Vergangenheit, bereits vorhanden)",
  );

  await addWindows(page, inDays(7), "9:30", "10:30");
  await expect(
    windowRow(page, 2).getByText("Dieses Zeitfenster überschneidet sich mit Zeitfenster 1."),
  ).toBeVisible();
  await expect(windowRow(page, 1).getByRole("alert")).toHaveCount(0);
});

test("only a richter can open the page", async ({ page, users }) => {
  await page.context().clearCookies();
  await signIn(page, await users.create({ roles: ["klaeger"] }));

  const response = await page.goto("/overview/new");

  expect(response?.status()).toBe(403);
});
