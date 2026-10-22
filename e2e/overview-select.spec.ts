import type { Kysely } from "kysely";

import type { Database } from "../app/database/types.ts";
import { expect, signIn, test } from "./fixtures.ts";

// 15:30 to 18:00 and 09:00 to 13:00 Berlin time in November are 14:30 to 17:00 and 08:00 to 12:00 UTC.
async function seedOpen(db: Kysely<Database>, userId: string) {
  const { id } = await db
    .insertInto("appointment")
    .values({ user_id: userId, aktenzeichen: "574 C 65412/26", status: "open" })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .insertInto("time_slot")
    .values([
      { appointment_id: id, start_time: "2099-11-09T14:30:00Z", end_time: "2099-11-09T17:00:00Z" },
      { appointment_id: id, start_time: "2099-11-13T08:00:00Z", end_time: "2099-11-13T12:00:00Z" },
    ])
    .execute();
  return id;
}

const FIRST = "9. November 2099 von 15:30 bis 18:00";

test("a judge chooses a shorter window, reviews it and confirms the Termin", async ({
  page,
  users,
  db,
}) => {
  const user = await users.create({ roles: ["richter"] });
  const id = await seedOpen(db, user.id);

  await signIn(page, user);
  await page.goto(`/overview/${id}`);
  await page.getByRole("link", { name: "Termin auswählen" }).click();

  await expect(page).toHaveURL(new RegExp(`/overview/${id}/select$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Wählen Sie ein Datum und eine Startzeit aus",
  );
  await expect(page.getByText("574 C 65412/26")).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(2);

  // A start before the window is rejected and the entry stays in place.
  await page.getByRole("radio", { name: FIRST }).check();
  await page.getByRole("textbox", { name: "Stunde" }).fill("15");
  await page.getByRole("textbox", { name: "Minute" }).fill("0");
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByText("Die Startzeit muss zwischen 15:30 und 18:00 liegen.")).toBeVisible();
  await expect(page.getByRole("radio", { name: FIRST })).toBeChecked();

  // A shorter window within the chosen one is accepted.
  await page.getByRole("textbox", { name: "Stunde" }).fill("16");
  await page.getByRole("textbox", { name: "Minute" }).fill("45");
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page).toHaveURL(new RegExp(`/overview/${id}/select/confirm`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Bitte überprüfen Sie Ihre Angaben",
  );
  await expect(page.getByText(/^\p{L}+, 9\. November 2099 um 16:45$/u)).toBeVisible();

  // Going back keeps the choice.
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page).toHaveURL(new RegExp(`/overview/${id}/select\\?`));
  await expect(page.getByRole("radio", { name: FIRST })).toBeChecked();
  await expect(page.getByRole("textbox", { name: "Stunde" })).toHaveValue("16");
  await expect(page.getByRole("textbox", { name: "Minute" })).toHaveValue("45");

  await page.getByRole("button", { name: "Weiter" }).click();
  await page.getByRole("button", { name: "Termin bestätigen" }).click();

  await expect(page).toHaveURL(new RegExp(`/overview/${id}/selected$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /^Der Termin ist am \p{L}+, 9\. November 2099 um 16:45\.$/u,
  );
  await expect(page.getByRole("button", { name: "Termindetails kopieren" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Ihre Servicestelle verschickt die Ladung." }),
  ).toBeVisible();

  // The overview and the detail page now show the confirmed Termin, not the whole proposed slot.
  await page.getByRole("link", { name: "Zu den Terminumfragen" }).click();
  await expect(
    page.getByRole("row", {
      name: /574 C 65412\/26.*Termin ist \p{L}+, 9\. November 2099 um 16:45/u,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "574 C 65412/26" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /^Der Termin ist am \p{L}+, 9\. November 2099 um 16:45\.$/u,
  );

  // Once confirmed, the choice is closed.
  await page.goto(`/overview/${id}/select`);
  await expect(page).toHaveURL(new RegExp(`/overview/${id}$`));
});

test("choosing a Termin needs a window and a valid start time", async ({ page, users, db }) => {
  const user = await users.create({ roles: ["richter"] });
  const id = await seedOpen(db, user.id);

  await signIn(page, user);
  await page.goto(`/overview/${id}/select`);

  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByText("Wählen Sie ein Zeitfenster aus.")).toBeVisible();

  await page.getByRole("radio", { name: "13. November 2099 von 09:00 bis 13:00" }).check();
  await page.getByRole("textbox", { name: "Stunde" }).fill("ab");
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByText("Geben Sie eine gültige Startzeit an.")).toBeVisible();

  // The end of the window is not a valid start either.
  await page.getByRole("textbox", { name: "Stunde" }).fill("13");
  await page.getByRole("textbox", { name: "Minute" }).fill("0");
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByText("Die Startzeit muss zwischen 09:00 und 13:00 liegen.")).toBeVisible();

  await page.getByRole("link", { name: "Abbrechen" }).click();
  await expect(page).toHaveURL(/\/overview$/);
});

test("the review sends a made-up choice back to the selection", async ({ page, users, db }) => {
  const user = await users.create({ roles: ["richter"] });
  const id = await seedOpen(db, user.id);

  await signIn(page, user);
  await page.goto(`/overview/${id}/select/confirm?fenster=0&stunde=19&minute=0`);

  await expect(page).toHaveURL(
    new RegExp(`/overview/${id}/select\\?fenster=0&stunde=19&minute=0$`),
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Wählen Sie ein Datum und eine Startzeit aus",
  );
});

test("another judge cannot choose a Termin for someone else's survey", async ({
  page,
  users,
  db,
}) => {
  const owner = await users.create({ roles: ["richter"] });
  const other = await users.create({ roles: ["richter"] });
  const id = await seedOpen(db, owner.id);

  await signIn(page, other);

  for (const path of ["select", "select/confirm?fenster=0&stunde=16&minute=0", "selected"]) {
    const response = await page.goto(`/overview/${id}/${path}`);
    expect(response?.status()).toBe(404);
  }
});
