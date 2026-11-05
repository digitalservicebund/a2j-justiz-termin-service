import type { Page } from "@playwright/test";
import type { Kysely } from "kysely";

import type { Database } from "../app/database/types.ts";
import { BASE_PATH, expect, messages, readMail, signIn, test } from "./fixtures.ts";

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
let judgeEmail: string;

async function slotCount(db: Kysely<Database>, appointmentId: string) {
  const { count } = await db
    .selectFrom("time_slot")
    .select((eb) => eb.fn.countAll<string>().as("count"))
    .where("appointment_id", "=", appointmentId)
    .executeTakeFirstOrThrow();
  return Number(count);
}

// The id of the draft, from the form (`?entwurf=`) or from the page of one of its slots.
const appointmentId = (page: Page) => {
  const { pathname, searchParams } = new URL(page.url());
  return searchParams.get("entwurf") ?? pathname.split("/")[3]!;
};

async function draftExists(db: Kysely<Database>, id: string) {
  const rows = await db.selectFrom("appointment").select("id").where("id", "=", id).execute();
  return rows.length > 0;
}

test.beforeEach(async ({ page, users }) => {
  const judge = await users.create({ roles: ["richter"] });
  judgeId = judge.id;
  judgeEmail = judge.email;
  await signIn(page, judge);
  await page.goto(`${BASE_PATH}/overview/new`);
  await expect(
    page.getByRole("heading", { level: 1, name: "Geben Sie die Verhandlungsdaten an" }),
  ).toBeVisible();
});

const groupField = (page: Page, group: string, label: string) =>
  page.getByRole("group", { name: group, exact: true }).getByRole("textbox", { name: label });

// Fills the page of a single time slot.
async function fillSlotPage(page: Page, window: Window) {
  const { day, month, year } = inDays(window.daysFromToday);
  await groupField(page, "Datum", "Tag").fill(day);
  await groupField(page, "Datum", "Monat").fill(month);
  await groupField(page, "Datum", "Jahr").fill(year);
  await groupField(page, "Beginn", "Stunde").fill(window.start[0]);
  await groupField(page, "Beginn", "Minute").fill(window.start[1]);
  await groupField(page, "Ende", "Stunde").fill(window.end[0]);
  await groupField(page, "Ende", "Minute").fill(window.end[1]);
}

// Adds a time slot the way a user does without JavaScript: through the page of its own.
async function addSlot(page: Page, window: Window) {
  await page.getByRole("button", { name: "Zeitfenster hinzufügen" }).click();
  await expect(page).toHaveURL(/\/zeitfenster\/neu$/);
  await fillSlotPage(page, window);
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page).toHaveURL(/\/overview\/new\?entwurf=/);
}

const slotRows = (page: Page) =>
  page.getByRole("table", { name: "Zeitfenster" }).locator("tbody tr");
const personRows = (page: Page) =>
  page.getByRole("table", { name: "Verfahrensbeteiligte" }).locator("tbody tr");

// Adds a person on the page of its own, the way a user does without JavaScript.
async function addPerson(page: Page, { email = "", name = "" }: { email?: string; name?: string }) {
  await page.getByRole("button", { name: "Person hinzufügen" }).click();
  await expect(page).toHaveURL(/\/verfahrensbeteiligte\/neu$/);
  if (email) await page.getByRole("textbox", { name: "E-Mail-Adresse" }).fill(email);
  if (name) await page.getByRole("textbox", { name: /^Name/ }).fill(name);
  await page.getByRole("button", { name: "Speichern" }).click();
}

// A draft that lives in the database only, for tests that need one in a given state.
async function seedDraft(db: Kysely<Database>, aktenzeichen: string, slots: number) {
  const { id } = await db
    .insertInto("appointment")
    .values({ user_id: judgeId, aktenzeichen, status: "draft" })
    .returning("id")
    .executeTakeFirstOrThrow();
  for (let index = 0; index < slots; index += 1) {
    const day = new Date();
    day.setUTCDate(day.getUTCDate() + 30);
    const start = new Date(
      Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate() - index, 10),
    );
    await db
      .insertInto("time_slot")
      .values({
        appointment_id: id,
        start_time: start,
        end_time: new Date(start.getTime() + 3_600_000),
      })
      .execute();
  }
  return id;
}

test("a richter creates a Terminumfrage with four time slots next week", async ({ page, db }) => {
  // Both tables start empty and say so.
  await expect(personRows(page)).toHaveText(["Sie haben keine Verfahrensbeteiligten angegeben."]);
  await expect(slotRows(page)).toHaveText(["Sie haben keine Zeitfenster angegeben."]);
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");

  // Every slot has a page of its own, and the Aktenzeichen survives the trips there and back.
  for (const window of nextWeek) {
    await addSlot(page, window);
    await expect(page.getByRole("textbox", { name: "Aktenzeichen" })).toHaveValue("574 C 65412/26");
  }
  await expect(slotRows(page)).toHaveCount(4);
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
  await expect(windows.getByText(/^\d{2}:\d{2} bis \d{2}:\d{2}$/)).toHaveText([
    "09:00 bis 10:30",
    "11:00 bis 12:00",
    "13:30 bis 15:00",
    "16:00 bis 17:15",
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
  await expect(page.getByRole("textbox", { name: "Link zur Terminumfrage" })).toHaveValue(
    new RegExp(`/umfrage/${universal_token}$`),
  );
  // Copying by button needs JavaScript; without it the link is there to select by hand.
  await expect(page.getByRole("button", { name: /kopieren/ })).toHaveCount(0);

  // The judge is told by e-mail, with the windows as tentative calendar events and a link back.
  const mail = await readMail(
    page.request,
    judgeEmail,
    "Terminumfrage erstellt: Wir warten auf Rückmeldungen",
  );
  const terminUrl = new URL(`${BASE_PATH}/overview/${id}`, page.url()).href;
  expect(mail.text).toContain(terminUrl);
  const calendar = mail.attachments["terminumfrage.ics"]!;
  expect(calendar.match(/BEGIN:VEVENT/g)).toHaveLength(4);
  expect(calendar).toContain("STATUS:TENTATIVE");
  expect(calendar).toContain("SEQUENCE:1");
  expect(calendar).toContain('ORGANIZER;CN="Verhandlungstermin-Finder":mailto:jts@example.com');
  expect(calendar.replace(/\r\n /g, "")).toContain(terminUrl);

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
  await addSlot(page, nextWeek[0]!);
  await addSlot(page, nextWeek[1]!);
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(
    page.getByRole("heading", { name: "Bitte überprüfen Sie Ihre Angaben" }),
  ).toBeVisible();
  const id = appointmentId(page);

  await page.getByRole("button", { name: "Zurück" }).click();

  await expect(page).toHaveURL(new RegExp(`/overview/new\\?entwurf=${id}$`));
  await expect(page.getByRole("textbox", { name: "Aktenzeichen" })).toHaveValue("574 C 65412/26");
  await expect(slotRows(page)).toHaveCount(2);
  await expect(slotRows(page).nth(1)).toContainText("11:00 bis 12:00");
  await expect(page.getByRole("alert")).toHaveCount(0);

  // Changing the Aktenzeichen and continuing edits the draft instead of creating a second one.
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
  await addSlot(page, nextWeek[0]!);
  await addSlot(page, nextWeek[1]!);
  const formPath = new URL(page.url()).pathname + new URL(page.url()).search;
  const id = new URL(page.url()).searchParams.get("entwurf")!;

  await page.context().clearCookies();
  await signIn(page, await users.create({ roles: ["richter"] }));

  for (const path of [
    formPath,
    `${BASE_PATH}/overview/${id}/confirm`,
    `${BASE_PATH}/overview/${id}/zeitfenster/neu`,
  ]) {
    const response = await page.goto(path);
    expect(response?.status(), path).toBe(404);
  }
});

test("the form shows what is missing and keeps what was typed", async ({ page }) => {
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page.getByText("Geben Sie ein Aktenzeichen an.")).toBeVisible();
  await expect(page).toHaveURL(/\/overview\/new$/);

  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page.getByText(TOO_FEW)).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Aktenzeichen" })).toHaveValue("574 C 65412/26");
  await expect(page.getByText("Geben Sie ein Aktenzeichen an.")).toBeHidden();
});

test("one time slot is not enough", async ({ page }) => {
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");
  await addSlot(page, nextWeek[0]!);

  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page.getByText(TOO_FEW)).toBeVisible();
  await expect(slotRows(page)).toHaveCount(1);

  // A second valid window resolves it.
  await addSlot(page, nextWeek[1]!);
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page).toHaveURL(/\/confirm$/);
});

test("a time slot with a problem is flagged in place and nothing is saved", async ({
  page,
  db,
}) => {
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");
  await page.getByRole("button", { name: "Zeitfenster hinzufügen" }).click();
  const url = page.url();
  await fillSlotPage(page, { ...nextWeek[1]!, end: ["10", "0"] });

  await page.getByRole("button", { name: "Speichern" }).click();

  await expect(page.getByText("Die Endzeit muss nach der Startzeit liegen.")).toBeVisible();
  await expect(page).toHaveURL(url);
  await expect(groupField(page, "Beginn", "Stunde")).toHaveValue("11");
  await expect(groupField(page, "Ende", "Stunde")).toHaveValue("10");
  await expect(groupField(page, "Ende", "Stunde")).toHaveAttribute("aria-invalid", "true");
  expect(await slotCount(db, appointmentId(page))).toBe(0);

  // Fixing it and saving again works.
  await groupField(page, "Ende", "Stunde").fill("12");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(slotRows(page)).toHaveCount(1);
});

test("an empty time slot is not saved", async ({ page }) => {
  await page.getByRole("button", { name: "Zeitfenster hinzufügen" }).click();

  await page.getByRole("button", { name: "Speichern" }).click();

  await expect(page.getByText("Geben Sie ein gültiges Datum an.")).toBeVisible();
  await expect(page.getByText("Geben Sie eine gültige Startzeit an.")).toBeVisible();
  await expect(page.getByText("Geben Sie eine gültige Endzeit an.")).toBeVisible();
});

test("a time slot that overlaps another names it, and one that only touches is fine", async ({
  page,
}) => {
  await addSlot(page, nextWeek[0]!);
  await page.getByRole("button", { name: "Zeitfenster hinzufügen" }).click();

  await fillSlotPage(page, { ...nextWeek[0]!, start: ["10", "0"], end: ["11", "0"] });
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(
    page.getByText(/überschneidet sich mit dem Zeitfenster am .*09:00 bis 10:30\./),
  ).toBeVisible();

  await groupField(page, "Beginn", "Stunde").fill("10");
  await groupField(page, "Beginn", "Minute").fill("30");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(slotRows(page)).toHaveCount(2);
});

test("a time slot can be edited, copied and deleted", async ({ page, db }) => {
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");
  await addSlot(page, nextWeek[0]!);
  await addSlot(page, nextWeek[1]!);
  const id = new URL(page.url()).searchParams.get("entwurf")!;
  const first = slotRows(page).first();

  // Edit: the page starts with the slot's values, and saving replaces it.
  await first.getByRole("button", { name: /bearbeiten$/ }).click();
  await expect(page).toHaveURL(new RegExp(`/overview/${id}/zeitfenster/(?!neu)[^/]+$`));
  await expect(groupField(page, "Beginn", "Stunde")).toHaveValue("09");
  await groupField(page, "Ende", "Minute").fill("45");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(slotRows(page)).toHaveCount(2);
  await expect(slotRows(page).first()).toContainText("09:00 bis 10:45");
  await expect(page.getByRole("textbox", { name: "Aktenzeichen" })).toHaveValue("574 C 65412/26");

  // Copy: the page starts with the same values, but saving adds a slot; it must not overlap.
  await slotRows(page)
    .first()
    .getByRole("button", { name: /kopieren$/ })
    .click();
  await expect(page).toHaveURL(/\/zeitfenster\/neu\?kopie=/);
  await expect(groupField(page, "Ende", "Minute")).toHaveValue("45");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText(/überschneidet sich mit dem Zeitfenster am/)).toBeVisible();
  await groupField(page, "Datum", "Tag").fill(String(Number(inDays(12).day)));
  await groupField(page, "Datum", "Monat").fill(inDays(12).month);
  await groupField(page, "Datum", "Jahr").fill(inDays(12).year);
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(slotRows(page)).toHaveCount(3);
  expect(await slotCount(db, id)).toBe(3);

  // Delete: gone at once, and the other slots stay.
  await slotRows(page)
    .last()
    .getByRole("button", { name: /löschen$/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`/overview/new\\?entwurf=${id}$`));
  await expect(slotRows(page)).toHaveCount(2);
  expect(await slotCount(db, id)).toBe(2);
});

test("a slot can be deleted below two, but then the form cannot continue", async ({ page }) => {
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");
  await addSlot(page, nextWeek[0]!);
  await addSlot(page, nextWeek[1]!);

  await slotRows(page)
    .first()
    .getByRole("button", { name: /löschen$/ })
    .click();
  await expect(slotRows(page)).toHaveCount(1);
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page.getByText(TOO_FEW)).toBeVisible();
});

test("Enter in the Aktenzeichen continues instead of editing the first slot", async ({ page }) => {
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");
  await addSlot(page, nextWeek[0]!);
  await addSlot(page, nextWeek[1]!);

  await page.getByRole("textbox", { name: "Aktenzeichen" }).press("Enter");

  await expect(page).toHaveURL(/\/confirm$/);
});

test("the form stops offering time slots at twenty", async ({ page, db }) => {
  const id = await seedDraft(db, "574 C 65412/26", 20);

  await page.goto(`${BASE_PATH}/overview/new?entwurf=${id}`);

  await expect(slotRows(page)).toHaveCount(20);
  await expect(page.getByRole("button", { name: "Zeitfenster hinzufügen" })).toBeDisabled();
  await expect(page.getByText("Sie können höchstens 20 Zeitfenster angeben.")).toBeVisible();
});

test("giving up removes a draft that is still empty and keeps one with content", async ({
  page,
  db,
}) => {
  await page.getByRole("button", { name: "Zeitfenster hinzufügen" }).click();
  const id = appointmentId(page);
  expect(await draftExists(db, id)).toBe(true);

  // The slot page has no draft to lose: its "Abbrechen" only goes back.
  await page.getByRole("link", { name: "Abbrechen" }).click();
  await expect(page).toHaveURL(new RegExp(`/overview/new\\?entwurf=${id}$`));
  expect(await draftExists(db, id)).toBe(true);

  await page.getByRole("button", { name: "Abbrechen" }).click();
  await expect(page).toHaveURL(/\/overview$/);
  expect(await draftExists(db, id)).toBe(false);

  // With an Aktenzeichen, the draft stays, and the overview offers to continue it.
  await page.goto(`${BASE_PATH}/overview/new`);
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");
  await page.getByRole("button", { name: "Zeitfenster hinzufügen" }).click();
  const kept = appointmentId(page);
  await page.getByRole("link", { name: "Abbrechen" }).click();
  await page.getByRole("button", { name: "Abbrechen" }).click();
  await expect(page).toHaveURL(/\/overview$/);
  expect(await draftExists(db, kept)).toBe(true);
  await expect(page.locator("tbody").getByText("Entwurf", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Terminumfrage 574 C 65412/26 öffnen" }).click();
  await expect(page).toHaveURL(new RegExp(`/overview/new\\?entwurf=${kept}$`));
  await expect(page.getByRole("textbox", { name: "Aktenzeichen" })).toHaveValue("574 C 65412/26");
});

test("a draft without an Aktenzeichen is still named in the overview", async ({ page, db }) => {
  const id = await seedDraft(db, "", 1);

  await page.goto(`${BASE_PATH}/overview`);
  await page.getByRole("link", { name: "Terminumfrage Ohne Aktenzeichen öffnen" }).click();

  await expect(page).toHaveURL(new RegExp(`/overview/new\\?entwurf=${id}$`));
});

test("an incomplete draft cannot be reviewed or published", async ({ page, db }) => {
  const id = await seedDraft(db, "574 C 65412/26", 1);

  await page.goto(`${BASE_PATH}/overview/${id}/confirm`);
  await expect(page).toHaveURL(new RegExp(`/overview/new\\?entwurf=${id}$`));

  // Even a hand-made submission of the review does not publish it.
  const response = await page.request.post(`${BASE_PATH}/overview/${id}/confirm`, {
    form: { intent: "create" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  const { status } = await db
    .selectFrom("appointment")
    .select("status")
    .where("id", "=", id)
    .executeTakeFirstOrThrow();
  expect(status).toBe("draft");
});

test("people can be added, edited and deleted on pages of their own", async ({ page, db }) => {
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");

  await addPerson(page, { email: " Person.A@Example.com ", name: "Person A" });
  await expect(page.getByRole("textbox", { name: "Aktenzeichen" })).toHaveValue("574 C 65412/26");
  await expect(personRows(page)).toHaveCount(1);
  await expect(personRows(page).first()).toContainText("person.a@example.com");
  await expect(personRows(page).first()).toContainText("Person A");
  const id = appointmentId(page);

  // Every person gets a personal link, but nobody is e-mailed before or after.
  const [stored] = await db
    .selectFrom("participant")
    .select(["email", "name", "type", "token"])
    .where("appointment_id", "=", id)
    .execute();
  expect(stored).toMatchObject({
    email: "person.a@example.com",
    name: "Person A",
    type: "individual",
  });
  expect(stored!.token).toMatch(/^[\w-]{32}$/);

  // Edit: the page starts with the saved values, and saving replaces them.
  await personRows(page)
    .first()
    .getByRole("button", { name: /bearbeiten$/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`/overview/${id}/verfahrensbeteiligte/(?!neu)[^/]+$`));
  await expect(page.getByRole("textbox", { name: "E-Mail-Adresse" })).toHaveValue(
    "person.a@example.com",
  );
  await page.getByRole("textbox", { name: "E-Mail-Adresse" }).fill("person.d@example.com");
  await page.getByRole("textbox", { name: /^Name/ }).fill("");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(personRows(page)).toHaveCount(1);
  await expect(personRows(page).first()).toContainText("person.d@example.com");
  await expect(personRows(page).first()).not.toContainText("Person A");
  const [edited] = await db
    .selectFrom("participant")
    .select(["email", "name", "token"])
    .where("appointment_id", "=", id)
    .execute();
  expect(edited).toEqual({ email: "person.d@example.com", name: null, token: stored!.token });

  // Delete: gone at once, back to the empty state.
  await personRows(page)
    .first()
    .getByRole("button", { name: /löschen$/ })
    .click();
  await expect(page).toHaveURL(new RegExp(`/overview/new\\?entwurf=${id}$`));
  await expect(personRows(page)).toHaveText(["Sie haben keine Verfahrensbeteiligten angegeben."]);
  expect(
    await db.selectFrom("participant").select("id").where("appointment_id", "=", id).execute(),
  ).toEqual([]);
});

test("a person without an e-mail address needs a name, and people may share both", async ({
  page,
  db,
}) => {
  await addPerson(page, { name: "Person B" });
  await expect(personRows(page)).toHaveCount(1);
  await addPerson(page, { email: "office@example.com", name: "Person B" });
  await addPerson(page, { email: "office@example.com", name: "Person B" });
  await expect(personRows(page)).toHaveCount(3);

  const rows = await db
    .selectFrom("participant")
    .select(["email", "name"])
    .where("appointment_id", "=", appointmentId(page))
    .orderBy("created_at")
    .execute();
  expect(rows).toEqual([
    { email: null, name: "Person B" },
    { email: "office@example.com", name: "Person B" },
    { email: "office@example.com", name: "Person B" },
  ]);
});

test("the page of a person flags what is wrong in place and saves nothing", async ({
  page,
  db,
}) => {
  await page.getByRole("button", { name: "Person hinzufügen" }).click();
  const url = page.url();

  await page.getByRole("button", { name: "Speichern" }).click();

  await expect(page.getByText("Geben Sie eine E-Mail-Adresse an.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "E-Mail-Adresse" })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page).toHaveURL(url);

  await page.getByRole("textbox", { name: "E-Mail-Adresse" }).fill("person.a");
  await page.getByRole("textbox", { name: /^Name/ }).fill("Person A");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Geben Sie eine gültige E-Mail-Adresse an.")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "E-Mail-Adresse" })).toHaveValue("person.a");
  await expect(page.getByRole("textbox", { name: /^Name/ })).toHaveValue("Person A");
  expect(
    await db
      .selectFrom("participant")
      .select("id")
      .where("appointment_id", "=", appointmentId(page))
      .execute(),
  ).toEqual([]);

  // The name field is optional and explains itself.
  await expect(page.getByRole("textbox", { name: "Name - Optional" })).toHaveAccessibleDescription(
    /keine persönliche E-Mail-Adresse/,
  );
});

test("the form stops offering people at twenty", async ({ page, db }) => {
  const id = await seedDraft(db, "574 C 65412/26", 0);
  await db
    .insertInto("participant")
    .values(
      Array.from({ length: 20 }, (_, index) => ({
        appointment_id: id,
        email: `person.${index}@example.com`,
        type: "individual" as const,
        token: `token-${id}-${index}`,
      })),
    )
    .execute();

  await page.goto(`${BASE_PATH}/overview/new?entwurf=${id}`);

  await expect(personRows(page)).toHaveCount(20);
  await expect(page.getByRole("button", { name: "Person hinzufügen" })).toBeDisabled();
  await expect(page.getByText("Sie können höchstens 20 Personen angeben.")).toBeVisible();
});

test("the people are reviewed, published with personal links and never e-mailed", async ({
  page,
  db,
  users,
}) => {
  const personEmail = users.email();
  await page.getByRole("textbox", { name: "Aktenzeichen" }).fill("574 C 65412/26");
  await addPerson(page, { email: personEmail });
  await addPerson(page, { name: "Person B" });
  await addSlot(page, nextWeek[0]!);
  await addSlot(page, nextWeek[1]!);
  const id = appointmentId(page);

  await page.getByRole("button", { name: "Weiter" }).click();
  const people = page.getByRole("group", { name: "Verfahrensbeteiligte", exact: true });
  await expect(people.getByRole("listitem")).toHaveText([personEmail, "Person B"]);
  await page.getByRole("button", { name: "Terminumfrage erstellen" }).click();
  await expect(page).toHaveURL(new RegExp(`/overview/${id}/created$`));

  const stored = await db
    .selectFrom("participant")
    .select(["email", "type", "token"])
    .where("appointment_id", "=", id)
    .orderBy("created_at")
    .execute();
  expect(stored.map(({ email, type }) => ({ email, type }))).toEqual([
    { email: personEmail, type: "individual" },
    { email: null, type: "individual" },
  ]);
  expect(new Set(stored.map(({ token }) => token)).size).toBe(2);

  // Only the judge is told; the people get no e-mail (the invitations are not sent yet).
  await readMail(page.request, judgeEmail, "Terminumfrage erstellt: Wir warten auf Rückmeldungen");
  expect(await messages(page.request, personEmail)).toEqual([]);

  // The personal link of a person who only has an address knows them, so the judge is told by
  // that address.
  await page.goto(`${BASE_PATH}/umfrage/${stored[0]!.token}`);
  await expect(page.getByRole("textbox", { name: "Ihr Name" })).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: /^Verfügbar/ })
    .first()
    .check();
  await page.getByRole("button", { name: "Weiter" }).click();
  await page.getByRole("button", { name: "Terminumfrage abschließen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Danke für das Angeben Ihrer Verfügbarkeiten.",
  );
  const answer = await readMail(page.request, judgeEmail, "Neue Antwort auf Ihre Terminumfrage");
  expect(answer.text).toContain(`${personEmail} hat auf Ihre Terminumfrage geantwortet.`);
});

test("only the richter who created the draft can open the page of a person", async ({
  page,
  users,
}) => {
  await page.getByRole("button", { name: "Person hinzufügen" }).click();
  const path = new URL(page.url()).pathname;

  await page.context().clearCookies();
  await signIn(page, await users.create({ roles: ["richter"] }));
  expect((await page.goto(path))?.status()).toBe(404);

  await page.context().clearCookies();
  await signIn(page, await users.create({ roles: ["klaeger"] }));
  expect((await page.goto(path))?.status()).toBe(403);
});

test("only a richter can open the slot page", async ({ page, users }) => {
  await page.context().clearCookies();
  await signIn(page, await users.create({ roles: ["klaeger"] }));

  const response = await page.goto(`${BASE_PATH}/overview/anything/zeitfenster/neu`);

  expect(response?.status()).toBe(403);
});

test("only a richter can open the page", async ({ page, users }) => {
  await page.context().clearCookies();
  await signIn(page, await users.create({ roles: ["klaeger"] }));

  const response = await page.goto(`${BASE_PATH}/overview/new`);

  expect(response?.status()).toBe(403);
});
