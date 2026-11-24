import type { Page } from "@playwright/test";

import { BASE_PATH, baseURL, expect, signIn, test } from "./fixtures.ts";

const SETTINGS = `${BASE_PATH}/einstellungen`;

async function fillSitzungstag(page: Page, weekday: string, start: string, end: string) {
  await page.getByRole("radio", { name: weekday }).check();
  const [startHour, startMinute] = start.split(":");
  const [endHour, endMinute] = end.split(":");
  const begin = page.getByRole("group", { name: "Beginn" });
  const finish = page.getByRole("group", { name: "Ende" });
  await begin.getByRole("textbox", { name: "Stunde" }).fill(startHour!);
  await begin.getByRole("textbox", { name: "Minute" }).fill(startMinute!);
  await finish.getByRole("textbox", { name: "Stunde" }).fill(endHour!);
  await finish.getByRole("textbox", { name: "Minute" }).fill(endMinute!);
  await page.getByRole("button", { name: "Speichern" }).click();
}

const rowTexts = (page: Page) =>
  page
    .getByRole("table", { name: "Sitzungstage und reguläre Verhandlungszeiten" })
    .getByRole("row")
    .evaluateAll((rows) =>
      rows
        .slice(1)
        .map((row) => [...row.querySelectorAll("td")].slice(0, 2).map((cell) => cell.textContent)),
    );

test("a judge adds, changes and deletes Sitzungstage", async ({ page, users, db }) => {
  const judge = await users.create({ roles: ["richter"] });
  await signIn(page, judge);

  await page
    .getByRole("navigation", { name: "Bereiche" })
    .getByRole("link", { name: "Einstellungen" })
    .click();
  await expect(page).toHaveURL(`${baseURL}/einstellungen`);
  await expect(page.getByText("Sie haben keine Sitzungstage hinzugefügt.")).toBeVisible();

  await page.getByRole("link", { name: "Sitzungstag hinzufügen" }).click();
  await expect(page).toHaveURL(`${baseURL}/einstellungen/sitzungstage/neu`);
  await fillSitzungstag(page, "Donnerstag", "09:00", "16:00");
  await expect(page).toHaveURL(`${baseURL}/einstellungen`);

  await page.getByRole("link", { name: "Sitzungstag hinzufügen" }).click();
  await fillSitzungstag(page, "Dienstag", "10:00", "17:00");
  // A second Sitzungstag on the same weekday.
  await page.getByRole("link", { name: "Sitzungstag hinzufügen" }).click();
  await fillSitzungstag(page, "Dienstag", "08:00", "10:00");

  expect(await rowTexts(page)).toEqual([
    ["Dienstag", "08:00 bis 10:00"],
    ["Dienstag", "10:00 bis 17:00"],
    ["Donnerstag", "09:00 bis 16:00"],
  ]);

  await page
    .getByRole("link", { name: "Sitzungstag Dienstag, 10:00 bis 17:00 bearbeiten" })
    .click();
  await expect(page.getByRole("radio", { name: "Dienstag" })).toBeChecked();
  await fillSitzungstag(page, "Mittwoch", "13:30", "15:00");

  await page
    .getByRole("button", { name: "Sitzungstag Donnerstag, 09:00 bis 16:00 löschen" })
    .click();

  expect(await rowTexts(page)).toEqual([
    ["Dienstag", "08:00 bis 10:00"],
    ["Mittwoch", "13:30 bis 15:00"],
  ]);
  // Stored as Berlin wall-clock times, without a date or an offset.
  expect(
    await db
      .selectFrom("sitzungstag")
      .select(["weekday", "start_time", "end_time"])
      .where("user_id", "=", judge.id)
      .orderBy("weekday")
      .execute(),
  ).toEqual([
    { weekday: 2, start_time: "08:00:00", end_time: "10:00:00" },
    { weekday: 3, start_time: "13:30:00", end_time: "15:00:00" },
  ]);
});

test("the form shows what is wrong and saves nothing", async ({ page, users, db }) => {
  const judge = await users.create({ roles: ["richter"] });
  await signIn(page, judge);
  await page.goto(`${SETTINGS}/sitzungstage/neu`);

  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Wählen Sie einen Sitzungstag aus.")).toBeVisible();
  await expect(page.getByText("Geben Sie eine gültige Startzeit an.")).toBeVisible();
  await expect(page.getByText("Geben Sie eine gültige Endzeit an.")).toBeVisible();

  await fillSitzungstag(page, "Montag", "12:00", "09:00");
  await expect(page.getByText("Die Endzeit muss nach der Startzeit liegen.")).toBeVisible();

  await fillSitzungstag(page, "Montag", "09:00", "12:00");
  await page.getByRole("link", { name: "Sitzungstag hinzufügen" }).click();
  await fillSitzungstag(page, "Montag", "11:00", "14:00");
  await expect(
    page.getByText("Dieser Sitzungstag überschneidet sich mit Montag, 09:00 bis 12:00."),
  ).toBeVisible();
  await expect(page.getByRole("radio", { name: "Montag" })).toBeChecked();

  await page.getByRole("link", { name: "Abbrechen" }).click();
  await expect(page).toHaveURL(`${baseURL}/einstellungen`);
  const rows = await db
    .selectFrom("sitzungstag")
    .select("id")
    .where("user_id", "=", judge.id)
    .execute();
  expect(rows).toHaveLength(1);
});

test("a judge cannot see or change another judge's Sitzungstag", async ({ page, users, db }) => {
  const other = await users.create({ roles: ["richter"] });
  const { id } = await db
    .insertInto("sitzungstag")
    .values({ user_id: other.id, weekday: 1, start_time: "09:00", end_time: "12:00" })
    .returning("id")
    .executeTakeFirstOrThrow();

  await signIn(page, await users.create({ roles: ["richter"] }));
  expect((await page.goto(`${SETTINGS}/sitzungstage/${id}`))?.status()).toBe(404);
  expect((await page.request.post(SETTINGS, { form: { intent: `delete:${id}` } })).status()).toBe(
    404,
  );
  expect(
    await db.selectFrom("sitzungstag").select("id").where("id", "=", id).executeTakeFirst(),
  ).toBeDefined();
});

for (const role of ["klaeger", "beklagter"] as const) {
  test(`a ${role} has no settings`, async ({ page, users }) => {
    await signIn(page, await users.create({ roles: [role] }));
    await expect(
      page.getByRole("navigation", { name: "Bereiche" }).getByText("Einstellungen"),
    ).toHaveCount(0);
    expect((await page.goto(SETTINGS))?.status()).toBe(403);
    expect((await page.goto(`${SETTINGS}/sitzungstage/neu`))?.status()).toBe(403);
  });
}

test("an admin has settings of their own", async ({ page, users }) => {
  await signIn(page, await users.createAdmin());
  await page
    .getByRole("navigation", { name: "Bereiche" })
    .getByRole("link", { name: "Einstellungen" })
    .click();
  await expect(page.getByText("Sie haben keine Sitzungstage hinzugefügt.")).toBeVisible();
});
