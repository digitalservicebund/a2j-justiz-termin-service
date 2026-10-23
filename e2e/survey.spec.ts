import { randomUUID } from "node:crypto";

import type { Kysely } from "kysely";

import type { AppointmentStatus, Database } from "../app/database/types.ts";
import { expect, test } from "./fixtures.ts";

// 15:30 to 18:00, 09:00 to 13:00 and 15:00 to 17:00 Berlin time in November are 14:30 to 17:00,
// 08:00 to 12:00 and 14:00 to 16:00 UTC.
async function seedSurvey(
  db: Kysely<Database>,
  userId: string,
  status: AppointmentStatus = "open",
) {
  const { id, universal_token } = await db
    .insertInto("appointment")
    .values({
      user_id: userId,
      aktenzeichen: "574 C 65412/26",
      status,
      universal_token: randomUUID(),
    })
    .returning(["id", "universal_token"])
    .executeTakeFirstOrThrow();
  const slots = await db
    .insertInto("time_slot")
    .values([
      { appointment_id: id, start_time: "2099-11-09T14:30:00Z", end_time: "2099-11-09T17:00:00Z" },
      { appointment_id: id, start_time: "2099-11-13T08:00:00Z", end_time: "2099-11-13T12:00:00Z" },
      { appointment_id: id, start_time: "2099-11-13T14:00:00Z", end_time: "2099-11-13T16:00:00Z" },
    ])
    .returning("id")
    .execute();
  return { id, token: universal_token!, slotIds: slots.map((slot) => slot.id) };
}

const FIRST = "Verfügbar am 9. November 2099, 15:30 bis 18:00";
const SECOND = "Verfügbar am 13. November 2099, 09:00 bis 13:00";
const THIRD = "Verfügbar am 13. November 2099, 15:00 bis 17:00";

test("a guest of the universal link gives a name and availabilities, reviews them and finishes", async ({
  page,
  users,
  db,
}) => {
  const judge = await users.create({ roles: ["richter"] });
  const { id, token } = await seedSurvey(db, judge.id);

  // No login is needed.
  await page.goto(`/umfrage/${token}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Geben Sie Ihre Verfügbarkeiten an",
  );
  await expect(page.getByText("574 C 65412/26")).toBeVisible();
  await expect(page.getByRole("main").getByRole("heading", { level: 2 })).toHaveText([
    "9. November 2099",
    "13. November 2099",
  ]);
  await expect(page.getByRole("checkbox", { name: /^Verfügbar/ })).toHaveCount(3);

  await page.getByRole("textbox", { name: "Ihr Name" }).fill("Guest C");
  await page.getByRole("checkbox", { name: FIRST }).check();
  await page.getByRole("checkbox", { name: THIRD }).check();
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page).toHaveURL(new RegExp(`/umfrage/${token}/zusammenfassung\\?`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Bitte überprüfen Sie Ihre Angaben",
  );
  await expect(page.getByText("574 C 65412/26")).toBeVisible();
  await expect(page.getByText("Guest C")).toBeVisible();
  await expect(page.getByText("15:30 – verfügbar")).toBeVisible();
  await expect(page.getByText("09:00 – nicht verfügbar")).toBeVisible();
  await expect(page.getByText("15:00 – verfügbar")).toBeVisible();

  // Nothing is stored before the guest finishes, and going back keeps the answer.
  expect(
    await db.selectFrom("participant").select("id").where("appointment_id", "=", id).execute(),
  ).toEqual([]);
  await page.getByRole("button", { name: "Zurück" }).click();
  await expect(page).toHaveURL(new RegExp(`/umfrage/${token}\\?`));
  await expect(page.getByRole("textbox", { name: "Ihr Name" })).toHaveValue("Guest C");
  await expect(page.getByRole("checkbox", { name: FIRST })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: SECOND })).not.toBeChecked();
  await expect(page.getByRole("checkbox", { name: THIRD })).toBeChecked();

  await page.getByRole("button", { name: "Weiter" }).click();
  await page.getByRole("button", { name: "Terminumfrage abschließen" }).click();

  await expect(page).toHaveURL(new RegExp(`/umfrage/${token}/naechste-schritte\\?teilnehmer=`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Danke für das Angeben Ihrer Verfügbarkeiten.",
  );
  await expect(page.getByText("15:30", { exact: true })).toBeVisible();
  await expect(page.getByText("15:00", { exact: true })).toBeVisible();
  await expect(page.getByText("09:00", { exact: true })).toHaveCount(0);

  const participants = await db
    .selectFrom("participant")
    .select(["id", "name", "type", "token"])
    .where("appointment_id", "=", id)
    .execute();
  expect(participants).toEqual([
    { id: expect.any(String), name: "Guest C", type: "universal", token: null },
  ]);
  const responses = await db
    .selectFrom("participant_response")
    .innerJoin("time_slot", "time_slot.id", "participant_response.slot_id")
    .select(["time_slot.start_time", "participant_response.status"])
    .where("participant_response.participant_id", "=", participants[0]!.id)
    .orderBy("time_slot.start_time")
    .execute();
  expect(responses.map((response) => response.status)).toEqual(["yes", "no", "yes"]);
});

test("a guest who has no time at all is told that no option works", async ({ page, users, db }) => {
  const judge = await users.create({ roles: ["richter"] });
  const { id, token } = await seedSurvey(db, judge.id);

  await page.goto(`/umfrage/${token}`);
  await page.getByRole("textbox", { name: "Ihr Name" }).fill("Guest C");
  await page.getByRole("checkbox", { name: "Kein Zeitfenster passt" }).check();
  await page.getByRole("button", { name: "Weiter" }).click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Bitte überprüfen Sie Ihre Angaben",
  );
  await expect(page.getByText("– nicht verfügbar")).toHaveCount(3);
  await expect(page.getByText(/– verfügbar$/)).toHaveCount(0);

  await page.getByRole("button", { name: "Terminumfrage abschließen" }).click();

  await expect(page).toHaveURL(new RegExp(`/umfrage/${token}/naechste-schritte\\?teilnehmer=`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Es gibt leider keine Terminoption, bei der alle Verfahrensbeteiligten Zeit haben.",
  );
  await expect(
    page.getByText("Das Gericht wird wahrscheinlich eine neue Terminumfrage erstellen."),
  ).toBeVisible();

  const statuses = await db
    .selectFrom("participant_response")
    .innerJoin("participant", "participant.id", "participant_response.participant_id")
    .select("participant_response.status")
    .where("participant.appointment_id", "=", id)
    .execute();
  expect(statuses.map((response) => response.status)).toEqual(["no", "no", "no"]);
});

test("the form needs a name and an answer", async ({ page, users, db }) => {
  const judge = await users.create({ roles: ["richter"] });
  const { id, token } = await seedSurvey(db, judge.id);

  await page.goto(`/umfrage/${token}`);
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByText("Geben Sie Ihren Namen an.")).toBeVisible();
  await expect(
    page.getByText(
      "Wählen Sie mindestens ein Zeitfenster aus oder geben Sie an, dass kein Zeitfenster passt.",
    ),
  ).toBeVisible();

  // What was entered stays in place while the rest is corrected.
  await page.getByRole("textbox", { name: "Ihr Name" }).fill("Guest C");
  await page.getByRole("checkbox", { name: SECOND }).check();
  await page.getByRole("checkbox", { name: "Kein Zeitfenster passt" }).check();
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(
    page.getByText(
      "Sie können nicht zugleich Zeitfenster auswählen und angeben, dass keines passt.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Ihr Name" })).toHaveValue("Guest C");
  await expect(page.getByRole("checkbox", { name: SECOND })).toBeChecked();

  await page.getByRole("checkbox", { name: "Kein Zeitfenster passt" }).uncheck();
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page).toHaveURL(new RegExp(`/umfrage/${token}/zusammenfassung`));

  expect(
    await db.selectFrom("participant").select("id").where("appointment_id", "=", id).execute(),
  ).toEqual([]);
});

test("the review and the result need a valid answer", async ({ page, users, db }) => {
  const judge = await users.create({ roles: ["richter"] });
  const { token } = await seedSurvey(db, judge.id);

  // A made-up answer goes back to the form.
  await page.goto(`/umfrage/${token}/zusammenfassung?name=Guest+C&verfuegbar=${randomUUID()}`);
  await expect(page).toHaveURL(new RegExp(`/umfrage/${token}\\?name=Guest\\+C`));
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Geben Sie Ihre Verfügbarkeiten an",
  );

  // Neither does the result page show anything for someone who has not answered.
  await page.goto(`/umfrage/${token}/naechste-schritte?teilnehmer=${randomUUID()}`);
  await expect(page).toHaveURL(new RegExp(`/umfrage/${token}$`));
  await page.goto(`/umfrage/${token}/naechste-schritte`);
  await expect(page).toHaveURL(new RegExp(`/umfrage/${token}$`));
});

test("a personal link knows the guest, asks for no name and answers once", async ({
  page,
  users,
  db,
}) => {
  const judge = await users.create({ roles: ["richter"] });
  const { id } = await seedSurvey(db, judge.id);
  const token = randomUUID();
  const { id: participantId } = await db
    .insertInto("participant")
    .values({ appointment_id: id, name: "Guest D", type: "individual", token })
    .returning("id")
    .executeTakeFirstOrThrow();

  await page.goto(`/umfrage/${token}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Geben Sie Ihre Verfügbarkeiten an",
  );
  await expect(page.getByRole("textbox", { name: "Ihr Name" })).toHaveCount(0);
  await page.getByRole("checkbox", { name: SECOND }).check();
  await page.getByRole("button", { name: "Weiter" }).click();

  // The review names the guest but does not offer to change the name.
  await expect(page.getByText("Guest D")).toBeVisible();
  await expect(page.getByRole("button", { name: "Bearbeiten Ihre Daten" })).toHaveCount(0);
  await page.getByRole("button", { name: "Terminumfrage abschließen" }).click();

  await expect(page).toHaveURL(
    new RegExp(`/umfrage/${token}/naechste-schritte\\?teilnehmer=${participantId}$`),
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Danke für das Angeben Ihrer Verfügbarkeiten.",
  );
  await expect(page.getByText("09:00", { exact: true })).toBeVisible();

  // No second participant was created, and opening the link again shows the result.
  expect(
    await db.selectFrom("participant").select("id").where("appointment_id", "=", id).execute(),
  ).toHaveLength(1);
  await page.goto(`/umfrage/${token}`);
  await expect(page).toHaveURL(new RegExp(`/umfrage/${token}/naechste-schritte\\?teilnehmer=`));
});

test("a window another participant has no time for is not offered", async ({ page, users, db }) => {
  const judge = await users.create({ roles: ["richter"] });
  const { id, token, slotIds } = await seedSurvey(db, judge.id);
  const { id: other } = await db
    .insertInto("participant")
    .values({ appointment_id: id, name: "Guest E", type: "universal" })
    .returning("id")
    .executeTakeFirstOrThrow();
  await db
    .insertInto("participant_response")
    .values([
      { participant_id: other, slot_id: slotIds[0]!, status: "no" },
      { participant_id: other, slot_id: slotIds[1]!, status: "yes" },
      { participant_id: other, slot_id: slotIds[2]!, status: "yes" },
    ])
    .execute();

  await page.goto(`/umfrage/${token}`);
  await expect(page.getByRole("checkbox", { name: /^Verfügbar/ })).toHaveCount(2);
  await expect(page.getByRole("checkbox", { name: FIRST })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 2, name: "9. November 2099" })).toHaveCount(0);

  await page.getByRole("textbox", { name: "Ihr Name" }).fill("Guest C");
  await page.getByRole("checkbox", { name: THIRD }).check();
  await page.getByRole("button", { name: "Weiter" }).click();
  await page.getByRole("button", { name: "Terminumfrage abschließen" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Danke für das Angeben Ihrer Verfügbarkeiten.",
  );
});

test("unknown, draft and closed surveys are not found", async ({ page, users, db }) => {
  const judge = await users.create({ roles: ["richter"] });
  const open = await seedSurvey(db, judge.id);
  const draft = await seedSurvey(db, judge.id, "draft");
  const confirmed = await seedSurvey(db, judge.id, "confirmed");

  // The appointment id is no link; only the universal token is.
  for (const token of [randomUUID(), open.id, draft.token, confirmed.token]) {
    for (const path of ["", "/zusammenfassung?keines=1&name=Guest+C", "/naechste-schritte"]) {
      const response = await page.goto(`/umfrage/${token}${path}`);
      expect(response?.status()).toBe(404);
    }
  }
});

test("answering a survey that closed in the meantime stores nothing", async ({
  page,
  users,
  db,
}) => {
  const judge = await users.create({ roles: ["richter"] });
  const { id, token } = await seedSurvey(db, judge.id);

  await page.goto(`/umfrage/${token}`);
  await page.getByRole("textbox", { name: "Ihr Name" }).fill("Guest C");
  await page.getByRole("checkbox", { name: FIRST }).check();
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page).toHaveURL(new RegExp(`/umfrage/${token}/zusammenfassung`));

  await db.updateTable("appointment").set({ status: "cancelled" }).where("id", "=", id).execute();
  await page.getByRole("button", { name: "Terminumfrage abschließen" }).click();

  await expect(page.getByText("404")).toBeVisible();
  expect(
    await db.selectFrom("participant").select("id").where("appointment_id", "=", id).execute(),
  ).toEqual([]);
});
