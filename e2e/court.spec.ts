import type { Page } from "@playwright/test";

import { BASE_PATH, expect, signIn, test } from "./fixtures.ts";

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

const groupField = (page: Page, group: string, label: string) =>
  page.getByRole("group", { name: group, exact: true }).getByRole("textbox", { name: label });

async function addSlot(page: Page, daysFromToday: number) {
  await page.getByRole("button", { name: "Zeitfenster hinzufügen" }).click();
  const { day, month, year } = inDays(daysFromToday);
  await groupField(page, "Datum", "Tag").fill(day);
  await groupField(page, "Datum", "Monat").fill(month);
  await groupField(page, "Datum", "Jahr").fill(year);
  await groupField(page, "Beginn", "Stunde").fill("9");
  await groupField(page, "Beginn", "Minute").fill("0");
  await groupField(page, "Ende", "Stunde").fill("11");
  await groupField(page, "Ende", "Minute").fill("0");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(
    page.getByRole("heading", { level: 1, name: "Geben Sie die Verhandlungsdaten an" }),
  ).toBeVisible();
}

const settingsSelect = (page: Page) =>
  page.getByRole("combobox", { name: "Gericht, an dem Sie normalerweise arbeiten" });

// The court of the draft, as the form names it, next to the button to change it.
const draftCourt = (page: Page) =>
  page.locator(".create-termin__court .kern-description-list-item__value");

test("a richter sets a default court, overrides it for one Terminumfrage and guests see it", async ({
  page,
  users,
  db,
}) => {
  const judge = await users.create({ roles: ["richter"] });
  await signIn(page, judge);

  // The settings save the court the judge normally works at.
  await page.goto(`${BASE_PATH}/einstellungen`);
  await expect(settingsSelect(page)).toHaveValue("");
  await settingsSelect(page).selectOption("B2402");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Ihr Standardgericht wurde gespeichert.")).toBeVisible();
  await expect(settingsSelect(page)).toHaveValue("B2402");

  // A new Terminumfrage starts with it.
  await page.goto(`${BASE_PATH}/overview/new`);
  await expect(draftCourt(page)).toContainText("Amtsgericht Biberach an der Riß");
  await expect(page.getByRole("combobox", { name: "Gericht" })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 1/26");
  await page.getByRole("textbox", { name: "Mindestdauer der Verhandlung in Minuten" }).fill("60");

  // The pencil opens a page of its own; what was typed survives the trip.
  await page.getByRole("button", { name: "Gericht ändern" }).click();
  await expect(
    page.getByRole("heading", { name: "An welchem Gericht findet die Verhandlung statt?" }),
  ).toBeVisible();
  const select = page.getByRole("combobox", { name: "Gericht" });
  await expect(select).toHaveValue("B2402");
  await select.selectOption("D2000");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(draftCourt(page)).toContainText("Oberlandesgericht München");
  await expect(page.getByRole("textbox", { name: "Aktenzeichen" })).toHaveValue("574 C 1/26");

  await addSlot(page, 7);
  await addSlot(page, 8);
  await page.getByRole("button", { name: "Weiter" }).click();

  const verhandlungsdaten = page.getByRole("group", { name: "Verhandlungsdaten", exact: true });
  await expect(verhandlungsdaten.getByText("Oberlandesgericht München")).toBeVisible();
  await page.getByRole("button", { name: "Terminumfrage erstellen" }).click();
  await expect(page).toHaveURL(/\/overview\/[^/]+\/created$/);
  const id = new URL(page.url()).pathname.split("/").at(-2)!;

  // The code is stored, and the default court stays as it was.
  const appointment = await db
    .selectFrom("appointment")
    .select(["court_code", "universal_token"])
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  expect(appointment.court_code).toBe("D2000");
  const richter = await db
    .selectFrom("richter")
    .select("default_court_code")
    .where("user_id", "=", judge.id)
    .executeTakeFirstOrThrow();
  expect(richter.default_court_code).toBe("B2402");

  // The judge's pages name the court under the Aktenzeichen.
  await page.goto(`${BASE_PATH}/overview/${id}`);
  await expect(page.getByText("Oberlandesgericht München", { exact: true })).toBeVisible();
  await page.goto(`${BASE_PATH}/overview`);
  await expect(
    page.getByRole("cell", { name: "574 C 1/26 Oberlandesgericht München" }),
  ).toBeVisible();

  // So does the survey of the guests.
  await page.goto(`${BASE_PATH}/umfrage/${appointment.universal_token}`);
  await expect(page.getByText("Gericht", { exact: true })).toBeVisible();
  await expect(page.getByText("Oberlandesgericht München")).toBeVisible();
});

test("a richter without a default court picks one in the form and keeps it as the default", async ({
  page,
  users,
  db,
}) => {
  const judge = await users.create({ roles: ["richter"] });
  await signIn(page, judge);
  await page.goto(`${BASE_PATH}/overview/new`);

  // Without a court, the review is out of reach.
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 2/26");
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByText("Wählen Sie ein Gericht aus.")).toBeVisible();

  await page.getByRole("combobox", { name: "Gericht" }).selectOption("D2000");
  await page.getByRole("checkbox", { name: "Als mein Standardgericht speichern" }).check();
  await page.getByRole("button", { name: "Person hinzufügen" }).click();
  await page.getByRole("link", { name: "Abbrechen" }).click();

  // Back in the form, the court is the draft's and the list is gone.
  await expect(draftCourt(page)).toContainText("Oberlandesgericht München");
  await expect(page.getByRole("checkbox")).toHaveCount(0);
  const id = new URL(page.url()).searchParams.get("entwurf")!;
  const draft = await db
    .selectFrom("appointment")
    .select("court_code")
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  expect(draft.court_code).toBe("D2000");

  // The settings show it as the default court.
  await page.goto(`${BASE_PATH}/einstellungen`);
  await expect(settingsSelect(page)).toHaveValue("D2000");
});
