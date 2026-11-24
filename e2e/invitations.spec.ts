import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { Kysely } from "kysely";

import type { AppointmentStatus, Database } from "../app/database/types.ts";
import { BASE_PATH, baseURL, expect, readMail, signIn, test } from "./fixtures.ts";

// A Terminumfrage with one slot and three guests: one reachable by e-mail, one by SAFE-ID only and
// one with a name only.
async function seed(
  db: Kysely<Database>,
  userId: string,
  guestEmail: string,
  status: AppointmentStatus = "open",
) {
  const { id } = await db
    .insertInto("appointment")
    .values({
      user_id: userId,
      aktenzeichen: "574 C 7/26",
      status,
      universal_token: `token-${randomUUID()}`,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  // 09:00 bis 10:30 Berlin time in summer.
  await db
    .insertInto("time_slot")
    .values({
      appointment_id: id,
      start_time: "2099-09-17T07:00:00Z",
      end_time: "2099-09-17T08:30:00Z",
    })
    .execute();
  const token = `token-${randomUUID()}`;
  await db
    .insertInto("participant")
    .values([
      { appointment_id: id, name: "Person A", email: guestEmail, type: "individual", token },
      {
        appointment_id: id,
        safe_id: "DE.Example.1",
        type: "individual",
        token: `token-${randomUUID()}`,
      },
      { appointment_id: id, name: "Person C", type: "individual", token: `token-${randomUUID()}` },
    ])
    .execute();
  return { id, token };
}

test("the judge invites each guest by e-mail, by ERV or records an invitation", async ({
  page,
  users,
  db,
}) => {
  const judge = await users.create({ roles: ["richter"] });
  const guestEmail = users.email();
  const { id, token } = await seed(db, judge.id, guestEmail);

  await signIn(page, judge);
  await page.goto(`${BASE_PATH}/overview/${id}`);

  const table = page.getByRole("table", { name: "Verfahrensbeteiligte" });
  await expect(table.getByText("Nicht eingeladen")).toHaveCount(3);

  // E-mail: the guest gets the personal survey link.
  const personA = page.getByRole("group", { name: "Person A einladen" });
  await expect(personA.getByRole("button", { name: "Per ERV" })).toHaveCount(0);
  await personA.getByRole("button", { name: "Per E-Mail" }).click();
  await expect(page).toHaveURL(`${baseURL}/overview/${id}#verfahrensbeteiligte`);
  await expect(page.getByRole("row", { name: /Person A/ })).toContainText("Per E-Mail eingeladen");
  const mail = await readMail(page.request, guestEmail, "Einladung zur Terminumfrage");
  expect(mail.text).toContain(`${baseURL}/umfrage/${token}`);
  expect(mail.text).toContain("574 C 7/26");

  // ERV: only a guest with a SAFE-ID can be reached that way.
  const safeIdOnly = page.getByRole("group", { name: "DE.Example.1 einladen" });
  await expect(safeIdOnly.getByRole("button", { name: "Per E-Mail" })).toHaveCount(0);
  await safeIdOnly.getByRole("button", { name: "Per ERV" }).click();
  await expect(page.getByRole("row", { name: /DE\.Example\.1/ })).toContainText(
    "Per ERV eingeladen",
  );

  // Manual: invited outside the app.
  const personC = page.getByRole("group", { name: "Person C einladen" });
  await expect(personC.getByRole("button")).toHaveCount(1);
  await personC.getByRole("button", { name: "Als eingeladen markieren" }).click();
  await expect(page.getByRole("row", { name: /Person C/ })).toContainText("Manuell eingeladen");

  // Inviting again keeps the earlier invitation: each is listed with its time, newest first.
  await page
    .getByRole("group", { name: "Person A einladen" })
    .getByRole("button", { name: "Als eingeladen markieren" })
    .click();
  const sent = page.getByRole("row", { name: /Person A/ }).getByRole("listitem");
  await expect(sent).toHaveText([
    /^Manuell eingeladen\s*am \p{L}+, \d{1,2}\. \p{L}+ \d{4} um \d{2}:\d{2}$/u,
    /^Per E-Mail eingeladen\s*am \p{L}+, \d{1,2}\. \p{L}+ \d{4} um \d{2}:\d{2}$/u,
  ]);
  await expect(table.getByText("Nicht eingeladen")).toHaveCount(0);

  const invitations = await db
    .selectFrom("participant_invitation")
    .innerJoin("participant", "participant.id", "participant_invitation.participant_id")
    .select("channel")
    .where("participant.appointment_id", "=", id)
    .orderBy("participant_invitation.created_at")
    .execute();
  expect(invitations.map(({ channel }) => channel)).toEqual(["email", "erv", "manual", "manual"]);
});

test("the judge invites the guests right after creating the Terminumfrage", async ({
  page,
  users,
  db,
}) => {
  const judge = await users.create({ roles: ["richter"] });
  const guestEmail = users.email();
  const { id, token } = await seed(db, judge.id, guestEmail);

  await signIn(page, judge);
  await page.goto(`${BASE_PATH}/overview/${id}/created`);

  const step = page.getByRole("listitem").filter({
    has: page.getByRole("heading", {
      name: "Laden Sie die Verfahrensbeteiligten zur Terminumfrage ein.",
    }),
  });
  await expect(step.getByRole("textbox", { name: "Link zur Terminumfrage" })).toBeVisible();

  await step
    .getByRole("group", { name: "Person A einladen" })
    .getByRole("button", { name: "Per E-Mail" })
    .click();
  // The page shows again, at the guest list.
  await expect(page).toHaveURL(`${baseURL}/overview/${id}/created#verfahrensbeteiligte`);
  await expect(page.getByRole("row", { name: /Person A/ })).toContainText("Per E-Mail eingeladen");
  const mail = await readMail(page.request, guestEmail, "Einladung zur Terminumfrage");
  expect(mail.text).toContain(`${baseURL}/umfrage/${token}`);

  await page
    .getByRole("group", { name: "DE.Example.1 einladen" })
    .getByRole("button", { name: "Per ERV" })
    .click();
  await expect(page.getByRole("row", { name: /DE\.Example\.1/ })).toContainText(
    "Per ERV eingeladen",
  );
});

test("a closed Terminumfrage shows the guests but cannot invite them", async ({
  page,
  users,
  db,
}) => {
  const judge = await users.create({ roles: ["richter"] });
  const { id } = await seed(db, judge.id, users.email(), "cancelled");
  const [guest] = await db
    .selectFrom("participant")
    .select("id")
    .where("appointment_id", "=", id)
    .execute();

  await signIn(page, judge);
  await page.goto(`${BASE_PATH}/overview/${id}`);

  await expect(page.getByRole("table", { name: "Verfahrensbeteiligte" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Als eingeladen markieren" })).toHaveCount(0);

  // A forged request is refused and records nothing.
  const response = await page.request.post(`${BASE_PATH}/overview/${id}`, {
    form: { intent: `invite-manual:${guest!.id}` },
    headers: { Origin: new URL(baseURL).origin },
  });
  expect(response.status()).toBe(404);
  const recorded = await db
    .selectFrom("participant_invitation")
    .select("id")
    .where("participant_id", "=", guest!.id)
    .execute();
  expect(recorded).toHaveLength(0);
});

test("another judge cannot invite the guests", async ({ page, users, db }) => {
  const owner = await users.create({ roles: ["richter"] });
  const other = await users.create({ roles: ["richter"] });
  const { id } = await seed(db, owner.id, users.email());
  const [guest] = await db
    .selectFrom("participant")
    .select("id")
    .where("appointment_id", "=", id)
    .execute();

  await signIn(page, other);
  const response = await page.request.post(`${BASE_PATH}/overview/${id}`, {
    form: { intent: `invite-manual:${guest!.id}` },
    headers: { Origin: new URL(baseURL).origin },
  });
  expect(response.status()).toBe(404);
});

const safeIdGuest = async (db: Kysely<Database>, appointmentId: string) =>
  db
    .selectFrom("participant")
    .select(["id", "token"])
    .where("appointment_id", "=", appointmentId)
    .where("safe_id", "=", "DE.Example.1")
    .executeTakeFirstOrThrow();

test("the judge downloads the invitation of a guest with a SAFE-ID as a PDF for the ERV", async ({
  page,
  users,
  db,
}) => {
  const judge = await users.create({ roles: ["richter"] });
  const { id } = await seed(db, judge.id, users.email());
  const guest = await safeIdGuest(db, id);

  await signIn(page, judge);
  await page.goto(`${BASE_PATH}/overview/${id}`);

  // Only the guest with a SAFE-ID gets the PDF.
  await expect(page.getByRole("link", { name: "PDF für ERV" })).toHaveCount(1);
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("group", { name: "DE.Example.1 einladen" })
    .getByRole("link", { name: "PDF für ERV" })
    .click();
  const download = await downloading;

  expect(download.suggestedFilename()).toBe("Einladung-Terminumfrage-574-C-7-26.pdf");
  const pdf = await readFile((await download.path())!);
  expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  // The link annotation carries the guest's personal survey URL.
  expect(pdf.toString("latin1")).toContain(`/URI (${baseURL}/umfrage/${guest.token})`);

  // Downloading is not an invitation: the judge records it after sending the PDF.
  await expect(page.getByRole("row", { name: /DE\.Example\.1/ })).toContainText("Nicht eingeladen");
  const recorded = await db
    .selectFrom("participant_invitation")
    .select("id")
    .where("participant_id", "=", guest.id)
    .execute();
  expect(recorded).toHaveLength(0);
});

const ervPdfPath = async (db: Kysely<Database>, appointmentId: string) =>
  `${BASE_PATH}/overview/${appointmentId}/verfahrensbeteiligte/${(await safeIdGuest(db, appointmentId)).id}/erv.pdf`;

test("the ERV PDF is not served for a closed Terminumfrage", async ({ page, users, db }) => {
  const judge = await users.create({ roles: ["richter"] });
  const { id } = await seed(db, judge.id, users.email(), "cancelled");

  await signIn(page, judge);
  const response = await page.request.get(await ervPdfPath(db, id));
  expect(response.status()).toBe(404);
});

test("another judge cannot download the ERV PDF", async ({ page, users, db }) => {
  const owner = await users.create({ roles: ["richter"] });
  const other = await users.create({ roles: ["richter"] });
  const { id } = await seed(db, owner.id, users.email());

  await signIn(page, other);
  const response = await page.request.get(await ervPdfPath(db, id));
  expect(response.status()).toBe(404);
});
