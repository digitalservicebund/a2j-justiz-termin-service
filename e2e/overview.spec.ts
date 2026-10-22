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

  // A draft continues on its confirmation page.
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

test("a cancelled termin survey opens a detail page with its time windows", async ({
  page,
  users,
  db,
}) => {
  const user = await users.create({ roles: ["richter"] });
  const id = await seed(db, user.id, "574 C 65412/26", "cancelled");
  // 10:00 to 14:00 and 09:00 to 11:00 Berlin time in September are 08:00 to 12:00 and 07:00 to 09:00 UTC.
  await db
    .insertInto("time_slot")
    .values([
      { appointment_id: id, start_time: "2026-09-17T08:00:00Z", end_time: "2026-09-17T12:00:00Z" },
      { appointment_id: id, start_time: "2026-09-21T07:00:00Z", end_time: "2026-09-21T09:00:00Z" },
    ])
    .execute();

  await signIn(page, user);
  await page.goto("/overview");
  await page.getByRole("link", { name: "574 C 65412/26" }).click();

  await expect(page).toHaveURL(new RegExp(`/overview/${id}$`));
  await expect(page.getByText("Kein Zeitfenster passt")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Es gibt leider keine Terminoption, bei der alle Verfahrensbeteiligten Zeit haben.",
  );
  await expect(page.getByText("17. September 2026")).toBeVisible();
  await expect(page.getByText("10:00 bis 14:00")).toBeVisible();
  await expect(page.getByText("21. September 2026")).toBeVisible();
  await expect(page.getByText("09:00 bis 11:00")).toBeVisible();

  await page.getByRole("link", { name: "Terminumfrage erstellen" }).click();
  await expect(page).toHaveURL(/\/overview\/new$/);
});

test("another judge cannot open the detail page of a termin survey", async ({
  page,
  users,
  db,
}) => {
  const owner = await users.create({ roles: ["richter"] });
  const other = await users.create({ roles: ["richter"] });
  const id = await seed(db, owner.id, "574 C 7/26", "cancelled");

  await signIn(page, other);
  const response = await page.goto(`/overview/${id}`);

  expect(response?.status()).toBe(404);
});

test("a confirmed termin survey opens a detail page announcing the date", async ({
  page,
  users,
  db,
}) => {
  const user = await users.create({ roles: ["richter"] });
  // 15:30 Berlin time in November is 14:30 UTC.
  const id = await seed(db, user.id, "574 C 65412/26", "confirmed", {
    start: "2099-11-09T14:30:00Z",
    end: "2099-11-09T15:30:00Z",
  });

  await signIn(page, user);
  await page.goto("/overview");
  await page.getByRole("link", { name: "574 C 65412/26" }).click();

  await expect(page).toHaveURL(new RegExp(`/overview/${id}$`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /^Der Termin ist am \p{L}+, 9\. November 2099 um 15:30\.$/u,
  );
  await expect(page.getByText(/^Termin ist \p{L}+, 9\. November 2099 um 15:30$/u)).toBeVisible();
  await expect(page.getByText("574 C 65412/26", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Zeitfenster" })).toHaveCount(0);

  await page.getByRole("link", { name: "Zurück zu den Terminumfragen" }).click();
  await expect(page).toHaveURL(/\/overview$/);
});

test("an open termin survey opens a detail page with its survey link", async ({
  page,
  users,
  db,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const user = await users.create({ roles: ["richter"] });
  const id = await seed(db, user.id, "574 C 65412/26", "open");
  await db
    .insertInto("time_slot")
    .values([
      { appointment_id: id, start_time: "2026-09-17T08:00:00Z", end_time: "2026-09-17T12:00:00Z" },
      { appointment_id: id, start_time: "2026-09-21T07:00:00Z", end_time: "2026-09-21T09:00:00Z" },
    ])
    .execute();

  await signIn(page, user);
  await page.goto("/overview");
  await page.getByRole("link", { name: "574 C 65412/26" }).click();

  await expect(page).toHaveURL(new RegExp(`/overview/${id}$`));
  await expect(page.getByText("Offen für Rückmeldungen")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Die Terminumfrage ist aktiv und die Verfahrensbeteiligten können ihre Verfügbarkeiten teilen.",
  );
  await expect(page.getByRole("button", { name: "Termin auswählen" })).toBeVisible();
  await expect(page.getByText("10:00 bis 14:00")).toBeVisible();
  await expect(page.getByText("21. September 2026")).toBeVisible();

  await page.getByRole("button", { name: "Link zur Terminumfrage kopieren" }).click();
  await expect(page.getByRole("button", { name: "Link kopiert" })).toBeVisible();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  expect(copied).toMatch(new RegExp(`/umfrage/${id}$`));
});

test("a past termin opens a detail page that looks back at it", async ({ page, users, db }) => {
  const user = await users.create({ roles: ["richter"] });
  // 13:30 Berlin time in August is 11:30 UTC.
  const id = await seed(db, user.id, "574 C 65412/26", "confirmed", {
    start: "2020-08-03T11:30:00Z",
    end: "2020-08-03T12:30:00Z",
  });
  await db
    .insertInto("time_slot")
    .values({
      appointment_id: id,
      start_time: "2020-07-27T08:00:00Z",
      end_time: "2020-07-27T12:00:00Z",
    })
    .execute();

  await signIn(page, user);
  await page.goto(`/overview/${id}`);

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    /^Der Termin war am \p{L}+, 3\. August 2020 um 13:30$/u,
  );
  await expect(page.getByRole("heading", { name: "Zeitfenster" })).toBeVisible();
  await expect(page.getByText("27. Juli 2020")).toBeVisible();
  await expect(page.getByText("10:00 bis 14:00")).toBeVisible();
});
