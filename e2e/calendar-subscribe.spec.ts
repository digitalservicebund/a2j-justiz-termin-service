import { randomUUID } from "node:crypto";

import type { Kysely } from "kysely";

import type { Database } from "../app/database/types.ts";
import { BASE_PATH, baseURL, expect, signIn, test } from "./fixtures.ts";

async function seed(
  db: Kysely<Database>,
  userId: string,
  aktenzeichen: string,
  status: "draft" | "open" | "confirmed" | "cancelled",
) {
  const { id } = await db
    .insertInto("appointment")
    .values({ user_id: userId, aktenzeichen, status, universal_token: `token-${randomUUID()}` })
    .returning("id")
    .executeTakeFirstOrThrow();
  const slot = await db
    .insertInto("time_slot")
    .values({
      appointment_id: id,
      start_time: "2099-11-09T14:30:00Z",
      end_time: "2099-11-09T15:30:00Z",
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  if (status === "confirmed") {
    await db
      .updateTable("appointment")
      .set({ confirmed_slot_id: slot.id })
      .where("id", "=", id)
      .execute();
  }
  return id;
}

const calendarToken = async (db: Kysely<Database>, userId: string) =>
  (
    await db
      .selectFrom("user")
      .select("calendar_token")
      .where("id", "=", userId)
      .executeTakeFirstOrThrow()
  ).calendar_token;

test("the subscription page shows the personal feed URL and instructions", async ({
  page,
  users,
  db,
}) => {
  const user = await users.create({ roles: ["richter"] });
  const token = await calendarToken(db, user.id);
  await signIn(page, user);

  await page.getByRole("link", { name: "Kalender abonnieren" }).click();

  await expect(page).toHaveURL(`${baseURL}/kalender-abonnieren`);
  await expect(page.getByRole("heading", { level: 1, name: "Kalender abonnieren" })).toBeVisible();
  const feedUrl = `${baseURL}/api/calendars/${token}/feed.ics`;
  await expect(page.getByLabel("Link zum Kalender")).toHaveValue(feedUrl);
  await expect(page.getByRole("link", { name: "In Kalender-App öffnen" })).toHaveAttribute(
    "href",
    feedUrl.replace(/^http/, "webcal"),
  );
  await expect(page.getByRole("heading", { level: 3 })).toHaveText([
    "Outlook",
    "Apple Kalender",
    "Google Kalender",
  ]);
});

test("the feed holds the open and confirmed appointments of its user only", async ({
  request,
  users,
  db,
}) => {
  const user = await users.create({ roles: ["richter"] });
  const other = await users.create({ roles: ["richter"] });
  await seed(db, user.id, "574 C 1/26", "open");
  await seed(db, user.id, "574 C 2/26", "confirmed");
  await seed(db, user.id, "574 C 3/26", "draft");
  await seed(db, user.id, "574 C 4/26", "cancelled");
  await seed(db, other.id, "574 C 9/26", "open");

  const response = await request.get(
    `${BASE_PATH}/api/calendars/${await calendarToken(db, user.id)}/feed.ics`,
  );

  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/calendar");
  // Long lines are folded: a line break followed by a space continues the previous line.
  const body = (await response.text()).replaceAll("\r\n ", "");
  expect(body).toContain("SUMMARY:Vorläufig: Verhandlung 574 C 1/26");
  expect(body).toContain("SUMMARY:Bestätigt: Verhandlung 574 C 2/26");
  expect(body).toContain("Zuletzt synchronisiert:");
  expect(body).not.toContain("574 C 3/26");
  expect(body).not.toContain("574 C 4/26");
  expect(body).not.toContain("574 C 9/26");
});

test("the feed does not accept the user ID, unknown or malformed tokens", async ({
  request,
  users,
}) => {
  const user = await users.create();

  for (const value of [user.id, randomUUID(), "not-a-token"]) {
    const response = await request.get(`${BASE_PATH}/api/calendars/${value}/feed.ics`);
    expect(response.status()).toBe(404);
  }
});

test("every user gets a different token, also when signing up on an allowed domain", async ({
  page,
  users,
  db,
}) => {
  const domain = await users.allowedDomain();
  const email = users.email(domain);
  const provisioned = await users.create();
  await signIn(page, { id: "", name: "", email, roles: ["richter"] });

  const created = await db
    .selectFrom("user")
    .select("calendar_token")
    .where("email", "=", email)
    .executeTakeFirstOrThrow();
  expect(created.calendar_token).toMatch(/^[0-9a-f-]{36}$/);
  expect(created.calendar_token).not.toBe(await calendarToken(db, provisioned.id));
});

test("anonymous visitors are sent to the start page", async ({ request }) => {
  const response = await request.get(`${BASE_PATH}/kalender-abonnieren`, { maxRedirects: 0 });
  expect(response.status()).toBe(302);
  expect(response.headers().location).toBe(BASE_PATH);
});
