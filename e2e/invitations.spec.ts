import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import type { Page } from "@playwright/test";
import type { Kysely } from "kysely";

import type { AppointmentStatus, Database } from "../app/database/types.ts";
import { xjustizErrors } from "../tests/xjustiz.ts";
import {
  BASE_PATH,
  baseURL,
  ervMessages,
  expect,
  readErvMessage,
  readMail,
  signIn,
  test,
} from "./fixtures.ts";

// Obviously fake SAFE-IDs. The local fake ERV Versand (tests/mock-services/fake-erv-versand.ts)
// answers "sent" for a new one per test, so each test finds its own messages there, and "Receiver
// Unknown" for the one with the all-zero UUID.
const newSafeId = () => `DE.Example.${randomUUID()}.0001`;
const UNKNOWN_SAFE_ID = "DE.Example.00000000-0000-0000-0000-000000000000.0000";

const safeIdRow = (page: Page, safeId: string) => page.getByRole("row").filter({ hasText: safeId });

// An ERV invitation is settled when the ERV's reply arrives, after the page showed it as pending.
// Without JavaScript the page does not update by itself, so reload until the row shows `text`.
async function expectRowEventually(page: Page, safeId: string, text: string) {
  await expect
    .poll(async () => {
      await page.reload();
      return safeIdRow(page, safeId).textContent();
    })
    .toContain(text);
}

// The ERV invitation the guest got: a valid XJustiz message with the PDF that holds their link.
async function expectErvInvitation(page: Page, safeId: string, token: string) {
  const message = await readErvMessage(page.request, safeId);
  expect(message.messageType).toBe("de.justiz.basisdienst.erv.send-egvp-message.v1");
  expect(message.reply).toBe("de.justiz.basisdienst.erv.egvp-message-sent.v1");

  const xml = message.xjustizMessage!;
  expect(await xjustizErrors(xml)).toEqual([]);
  expect(xml).toContain(`<tns:sonstige>${safeId}</tns:sonstige>`);
  expect(xml).toContain(
    "<tns:kurzrubrum>Terminumfrage zum Aktenzeichen 574 C 7/26</tns:kurzrubrum>",
  );
  expect(xml).toContain("<tns:dateiname>Nachrichtentext.pdf</tns:dateiname>");

  expect(Object.keys(message.attachments)).toEqual(["Nachrichtentext.pdf"]);
  const pdf = message.attachments["Nachrichtentext.pdf"]!;
  expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  // The link annotation carries the guest's personal survey URL.
  expect(pdf.toString("latin1")).toContain(`/URI (${baseURL}/umfrage/${token})`);
}

// A Terminumfrage with one slot and three guests: one reachable by e-mail, one by SAFE-ID only and
// one with a name only.
async function seed(
  db: Kysely<Database>,
  userId: string,
  guestEmail: string,
  status: AppointmentStatus = "open",
  safeId: string = newSafeId(),
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
  const safeIdToken = `token-${randomUUID()}`;
  await db
    .insertInto("participant")
    .values([
      { appointment_id: id, name: "Person A", email: guestEmail, type: "individual", token },
      { appointment_id: id, safe_id: safeId, type: "individual", token: safeIdToken },
      { appointment_id: id, name: "Person C", type: "individual", token: `token-${randomUUID()}` },
    ])
    .execute();
  return { id, token, safeId, safeIdToken };
}

test("the judge invites each guest by e-mail, by ERV or records an invitation", async ({
  page,
  users,
  db,
}) => {
  const judge = await users.create({ roles: ["richter"] });
  const guestEmail = users.email();
  const { id, token, safeId, safeIdToken } = await seed(db, judge.id, guestEmail);

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

  // ERV: only a guest with a SAFE-ID can be reached that way. They get the PDF with their link.
  const safeIdOnly = page.getByRole("group", { name: `${safeId} einladen` });
  await expect(safeIdOnly.getByRole("button", { name: "Per E-Mail" })).toHaveCount(0);
  await safeIdOnly.getByRole("button", { name: "Per ERV" }).click();
  await expectRowEventually(page, safeId, "Per ERV eingeladen");
  await expectErvInvitation(page, safeId, safeIdToken);

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
  const { id, token, safeId, safeIdToken } = await seed(db, judge.id, guestEmail);

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
    .getByRole("group", { name: `${safeId} einladen` })
    .getByRole("button", { name: "Per ERV" })
    .click();
  await expectRowEventually(page, safeId, "Per ERV eingeladen");
  await expectErvInvitation(page, safeId, safeIdToken);
});

test("an ERV invitation the ERV does not deliver shows as not delivered", async ({
  page,
  users,
  db,
}) => {
  const judge = await users.create({ roles: ["richter"] });
  const { id } = await seed(db, judge.id, users.email(), "open", UNKNOWN_SAFE_ID);

  await signIn(page, judge);
  await page.goto(`${BASE_PATH}/overview/${id}`);
  await page
    .getByRole("group", { name: `${UNKNOWN_SAFE_ID} einladen` })
    .getByRole("button", { name: "Per ERV" })
    .click();

  // Handed over without an error; the ERV's reply comes later.
  await expect(page).toHaveURL(`${baseURL}/overview/${id}#verfahrensbeteiligte`);
  await expect(page.getByText("konnte nicht gesendet werden")).toHaveCount(0);
  await expectRowEventually(page, UNKNOWN_SAFE_ID, "Per ERV: nicht zugestellt");

  // The ERV got the invitation and refused it.
  const [message] = await ervMessages(page.request, UNKNOWN_SAFE_ID);
  expect(message!.reply).toBe("de.justiz.basisdienst.erv.send-egvp-message-failed.v1");
  const recorded = await db
    .selectFrom("participant_invitation")
    .innerJoin("participant", "participant.id", "participant_invitation.participant_id")
    .select(["status", "failure"])
    .where("participant.appointment_id", "=", id)
    .execute();
  expect(recorded).toEqual([
    {
      status: "failed",
      failure: "https://schemas.service.justiz.de/basisdienst/erv/problems/receiver-unknown",
    },
  ]);
});

test("an ERV invitation to a malformed SAFE-ID is not sent at all", async ({ page, users, db }) => {
  const judge = await users.create({ roles: ["richter"] });
  const { id } = await seed(db, judge.id, users.email(), "open", "DE.Example.1");

  await signIn(page, judge);
  await page.goto(`${BASE_PATH}/overview/${id}`);
  await page
    .getByRole("group", { name: "DE.Example.1 einladen" })
    .getByRole("button", { name: "Per ERV" })
    .click();

  await expect(
    page.getByText("Die Einladung an DE.Example.1 konnte nicht gesendet werden."),
  ).toBeVisible();
  await expect(safeIdRow(page, "DE.Example.1")).toContainText("Nicht eingeladen");
  expect(await ervMessages(page.request, "DE.Example.1")).toEqual([]);
  const recorded = await db
    .selectFrom("participant_invitation")
    .innerJoin("participant", "participant.id", "participant_invitation.participant_id")
    .select("participant_invitation.id")
    .where("participant.appointment_id", "=", id)
    .execute();
  expect(recorded).toHaveLength(0);
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
    .where("safe_id", "is not", null)
    .executeTakeFirstOrThrow();

test("the judge downloads the invitation of a guest with a SAFE-ID as a PDF for the ERV", async ({
  page,
  users,
  db,
}) => {
  const judge = await users.create({ roles: ["richter"] });
  const { id, safeId } = await seed(db, judge.id, users.email());
  const guest = await safeIdGuest(db, id);

  await signIn(page, judge);
  await page.goto(`${BASE_PATH}/overview/${id}`);

  // Only the guest with a SAFE-ID gets the PDF.
  await expect(page.getByRole("link", { name: "PDF für ERV" })).toHaveCount(1);
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("group", { name: `${safeId} einladen` })
    .getByRole("link", { name: "PDF für ERV" })
    .click();
  const download = await downloading;

  expect(download.suggestedFilename()).toBe("Einladung-Terminumfrage-574-C-7-26.pdf");
  const pdf = await readFile((await download.path())!);
  expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  // The link annotation carries the guest's personal survey URL.
  expect(pdf.toString("latin1")).toContain(`/URI (${baseURL}/umfrage/${guest.token})`);

  // Downloading is not an invitation: the judge records it after sending the PDF.
  await expect(safeIdRow(page, safeId)).toContainText("Nicht eingeladen");
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
