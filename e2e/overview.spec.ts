import type { Kysely } from "kysely";

import type { AppointmentStatus, Database } from "../app/database/types.ts";
import { expect, signIn, test } from "./fixtures.ts";

async function seed(
  db: Kysely<Database>,
  userId: string,
  aktenzeichen: string,
  status: AppointmentStatus,
  confirmed?: { start: string; end: string },
) {
  const { id } = await db
    .insertInto("appointment")
    .values({ user_id: userId, aktenzeichen, status })
    .returning("id")
    .executeTakeFirstOrThrow();
  if (confirmed) {
    const slot = await db
      .insertInto("time_slot")
      .values({ appointment_id: id, start_time: confirmed.start, end_time: confirmed.end })
      .returning("id")
      .executeTakeFirstOrThrow();
    await db
      .updateTable("appointment")
      .set({ confirmed_slot_id: slot.id })
      .where("id", "=", id)
      .execute();
  }
  return id;
}

test("overview lists the user's termin surveys with their status, newest first", async ({
  page,
  users,
  db,
}) => {
  const user = await users.create({ roles: ["richter"] });
  const other = await users.create({ roles: ["richter"] });
  await seed(db, user.id, "574 C 1/26", "cancelled");
  await seed(db, user.id, "574 C 2/26", "open");
  // 15:30 Berlin time in November is 14:30 UTC; 13:30 in August is 11:30 UTC.
  await seed(db, user.id, "574 C 3/26", "confirmed", {
    start: "2099-11-09T14:30:00Z",
    end: "2099-11-09T15:30:00Z",
  });
  await seed(db, user.id, "574 C 4/26", "confirmed", {
    start: "2020-08-03T11:30:00Z",
    end: "2020-08-03T12:30:00Z",
  });
  const draftId = await seed(db, user.id, "574 C 5/26", "draft");
  await seed(db, other.id, "574 C 9/26", "open");

  await signIn(page, user);
  await page.goto("/overview");

  await expect(page.getByRole("heading", { name: "Übersicht" })).toBeAttached();
  await expect(page.getByRole("link", { name: "Terminumfrage erstellen" })).toBeVisible();
  const rows = page.locator("tbody tr");
  await expect(rows).toHaveCount(5);
  await expect(rows.first()).toContainText("574 C 5/26");
  await expect(rows.first()).toContainText("Entwurf");
  await expect(
    page.getByRole("row", { name: /574 C 1\/26.*Kein Zeitfenster passt/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /574 C 2\/26.*Offen für Rückmeldungen/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row", { name: /574 C 3\/26.*Termin ist \p{L}+, 9\. November 2099 um 15:30/u }),
  ).toBeVisible();
  // An appointment that is over loses the announcement and is greyed out.
  const past = page.getByRole("row", { name: /574 C 4\/26/ });
  await expect(past).toContainText(/\p{L}+, 3\. August 2020 um 13:30/u);
  await expect(past).not.toContainText("Termin ist");
  // Only the judge's own appointments are listed.
  await expect(page.getByText("574 C 9/26")).toHaveCount(0);

  // A draft continues on its confirmation page; the other rows are not links.
  await expect(page.getByRole("link", { name: "574 C 2/26" })).toHaveCount(0);
  await page.getByRole("link", { name: "574 C 5/26" }).click();
  await expect(page).toHaveURL(new RegExp(`/overview/${draftId}/confirm$`));
});

test("overview tells a user without appointments that there are none", async ({ page, users }) => {
  await signIn(page, await users.create());
  await page.goto("/overview");

  await expect(page.getByText("Sie haben noch keine Terminumfragen erstellt.")).toBeVisible();
  await expect(page.locator("table")).toHaveCount(0);
});

test("a richter can open the create-termin page from the overview", async ({ page, users }) => {
  await signIn(page, await users.create({ roles: ["richter"] }));
  await page.goto("/overview");

  await page.getByRole("link", { name: "Terminumfrage erstellen" }).click();

  await expect(page).toHaveURL(/\/overview\/new$/);
  await expect(page.getByRole("heading", { name: "Verhandlungsdaten" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Aktenzeichen" })).toBeVisible();
});
