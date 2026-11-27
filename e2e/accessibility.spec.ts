import { randomUUID } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { Kysely } from "kysely";

import type { AppointmentStatus, Database } from "../app/database/types.ts";
import { BASE_PATH, expect, signIn, test } from "./fixtures.ts";

// Every page runs through axe-core in the light and the dark colour scheme. The app follows the
// system preference, so a colour that does not switch with it (a fixed palette token instead of a
// semantic one) shows up here as a contrast violation in one of the two schemes.

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type ColorScheme = "light" | "dark";

// axe-core is a script, but every spec runs with JavaScript switched off, and Playwright cannot run
// a script in such a page. So axe checks a copy: the page's current markup, served at the same
// address to a page that runs scripts, in the same colour scheme and size. A content security policy
// keeps the app's own scripts from running there; axe, which Playwright injects, is not affected.
// The app's styles load from the server as usual. axe sees the page as it is without JavaScript.
async function analyze(page: Page, colorScheme: ColorScheme) {
  const html = await page.content();
  const url = page.url();
  const context = await page
    .context()
    .browser()!
    .newContext({ colorScheme, viewport: page.viewportSize(), javaScriptEnabled: true });
  try {
    // As for the page itself, requests to other sites only slow the copy down.
    await context.route(
      (address) => address.origin !== new URL(url).origin,
      (route) => route.abort(),
    );
    const copy = await context.newPage();
    await copy.route(
      (address) => address.href === url,
      (route) =>
        route.fulfill({
          contentType: "text/html",
          headers: { "Content-Security-Policy": "script-src 'none'" },
          body: html,
        }),
    );
    await copy.goto(url);
    return await new AxeBuilder({ page: copy }).withTags(WCAG_TAGS).analyze();
  } finally {
    await context.close();
  }
}

async function expectAccessible(page: Page, colorScheme: ColorScheme, where: string) {
  await expect(page.getByRole("heading", { level: 1 }), `${where} has rendered`).toBeVisible();
  const { violations } = await analyze(page, colorScheme);
  const summary = violations.map(({ id, help, nodes }) => ({
    id,
    help,
    targets: nodes.map((node) => node.target.join(" ")),
  }));
  expect(summary, `axe violations on ${where}`).toEqual([]);
}

// 15:30 to 18:00 and 09:00 to 13:00 Berlin time in November are 14:30 to 17:00 and 08:00 to 12:00 UTC.
async function seed(db: Kysely<Database>, userId: string, status: AppointmentStatus) {
  const { id, universal_token } = await db
    .insertInto("appointment")
    .values({
      user_id: userId,
      aktenzeichen: "574 C 65412/26",
      court_code: "B2402",
      // A confirmed appointment needs its slot, so it is confirmed once the slots exist.
      status: status === "confirmed" ? "open" : status,
      universal_token: randomUUID(),
      min_duration_minutes: 60,
    })
    .returning(["id", "universal_token"])
    .executeTakeFirstOrThrow();
  const slots = await db
    .insertInto("time_slot")
    .values([
      { appointment_id: id, start_time: "2099-11-09T14:30:00Z", end_time: "2099-11-09T17:00:00Z" },
      { appointment_id: id, start_time: "2099-11-13T08:00:00Z", end_time: "2099-11-13T12:00:00Z" },
    ])
    .returning("id")
    .execute();
  const { id: participantId } = await db
    .insertInto("participant")
    .values({
      appointment_id: id,
      name: "Person A",
      email: "person.a@example.com",
      type: "individual",
      token: randomUUID(),
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  if (status === "confirmed") {
    await db
      .updateTable("appointment")
      .set({
        status,
        confirmed_slot_id: slots[0]!.id,
        confirmed_start_time: "2099-11-09T14:30:00Z",
        confirmed_end_time: "2099-11-09T17:00:00Z",
      })
      .where("id", "=", id)
      .execute();
  }
  return { id, token: universal_token!, slotIds: slots.map((slot) => slot.id), participantId };
}

// Each test checks many pages, and axe takes a while on each.
test.describe.configure({ timeout: 120_000 });

// The pages load an icon font from Google Fonts, which can take seconds and plays no part in the
// checks. Only the app's own requests go through.
test.beforeEach(async ({ context, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  await context.route(
    (address) => address.origin !== origin,
    (route) => route.abort(),
  );
});

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`in the ${colorScheme} colour scheme`, () => {
    test.use({ colorScheme });

    test("the public pages are accessible", async ({ page, users, db }) => {
      const judge = await users.create({ roles: ["richter"] });
      const { token, slotIds } = await seed(db, judge.id, "open");

      await page.goto(`${BASE_PATH}/`);
      await expectAccessible(page, colorScheme, "the welcome page");

      // The login form with an error.
      await page.getByRole("textbox", { name: "E‑Mail-Adresse" }).fill("kein-e-mail");
      await page.getByRole("button", { name: "Anmelden", exact: true }).click();
      await expect(page.locator(".login-form--error")).toBeVisible();
      await expectAccessible(page, colorScheme, "the welcome page with a login error");

      await page.goto(`${BASE_PATH}/gibt-es-nicht`);
      await expectAccessible(page, colorScheme, "the not-found page");

      await page.goto(`${BASE_PATH}/umfrage/${token}`);
      await expectAccessible(page, colorScheme, "the survey");

      // The survey with an error: no name and no answer.
      await page.getByRole("button", { name: "Weiter" }).click();
      await expect(page.getByText("Geben Sie Ihren Namen an.")).toBeVisible();
      await expectAccessible(page, colorScheme, "the survey with errors");

      await page.goto(
        `${BASE_PATH}/umfrage/${token}/zeitfenster?name=Guest+C&angebot=${slotIds[0]}`,
      );
      await expectAccessible(page, colorScheme, "the smaller window of the survey");

      await page.goto(`${BASE_PATH}/umfrage/${token}/zusammenfassung?name=Guest+C&keines=1`);
      await expectAccessible(page, colorScheme, "the survey review");

      await page.getByRole("button", { name: "Terminumfrage abschließen" }).click();
      await expect(page).toHaveURL(/\/naechste-schritte\?teilnehmer=/);
      await expectAccessible(page, colorScheme, "the survey result");
    });

    test("the judge's pages are accessible", async ({ page, users, db }) => {
      const judge = await users.create({ roles: ["richter"] });
      const draft = await seed(db, judge.id, "draft");
      const open = await seed(db, judge.id, "open");
      const confirmed = await seed(db, judge.id, "confirmed");
      const sitzungstag = await db
        .insertInto("sitzungstag")
        .values({ user_id: judge.id, weekday: 2, start_time: "10:00", end_time: "17:00" })
        .returning("id")
        .executeTakeFirstOrThrow();
      await signIn(page, judge);

      const pages = [
        ["/overview", "the overview"],
        ["/kalender-abonnieren", "the calendar subscription"],
        ["/einstellungen", "the settings"],
        ["/einstellungen/sitzungstage/neu", "a new Sitzungstag"],
        [`/einstellungen/sitzungstage/${sitzungstag.id}`, "a Sitzungstag"],
        ["/overview/new", "a new Terminumfrage"],
        [`/overview/new?entwurf=${draft.id}`, "a draft Terminumfrage"],
        [`/overview/${draft.id}/zeitfenster/neu`, "a new time slot"],
        [`/overview/${draft.id}/zeitfenster/${draft.slotIds[0]}`, "a time slot"],
        [`/overview/${draft.id}/verfahrensbeteiligte/neu`, "a new participant"],
        [`/overview/${draft.id}/verfahrensbeteiligte/${draft.participantId}`, "a participant"],
        [`/overview/${draft.id}/gericht`, "the court of a draft"],
        [`/overview/${draft.id}/confirm`, "the review of a draft"],
        [`/overview/${open.id}/created`, "the created page"],
        [`/overview/${open.id}`, "an open Terminumfrage"],
        [`/overview/${open.id}/select`, "the choice of a Termin"],
        [
          `/overview/${open.id}/select/confirm?fenster=0&stunde=16&minute=0`,
          "the review of a Termin",
        ],
        [`/overview/${confirmed.id}/selected`, "the confirmed Termin"],
        [`/overview/${confirmed.id}`, "a confirmed Terminumfrage"],
      ];
      for (const [path, where] of pages) {
        await page.goto(`${BASE_PATH}${path}`);
        await expectAccessible(page, colorScheme, where!);
      }

      // A form with errors.
      await page.goto(`${BASE_PATH}/overview/new`);
      await page.getByRole("button", { name: "Weiter" }).click();
      await expect(page.getByRole("alert").first()).toBeVisible();
      await expectAccessible(page, colorScheme, "a new Terminumfrage with errors");

      await page.goto(`${BASE_PATH}/einstellungen/sitzungstage/neu`);
      await page.getByRole("button", { name: "Speichern" }).click();
      await expect(page.getByRole("alert").first()).toBeVisible();
      await expectAccessible(page, colorScheme, "a new Sitzungstag with errors");
    });

    test("the empty overview is accessible", async ({ page, users }) => {
      await signIn(page, await users.create({ roles: ["richter"] }));
      await expectAccessible(page, colorScheme, "the empty overview");
      await page.goto(`${BASE_PATH}/einstellungen`);
      await expectAccessible(page, colorScheme, "the empty settings");
    });

    test("the admin pages are accessible", async ({ page, users }) => {
      await signIn(page, await users.createAdmin());

      for (const [path, where] of [
        ["/admin/users", "the user management"],
        ["/admin/domains", "the domain management"],
      ]) {
        await page.goto(`${BASE_PATH}${path}`);
        await expectAccessible(page, colorScheme, where!);
      }
    });
  });
}
