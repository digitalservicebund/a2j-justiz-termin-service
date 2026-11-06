import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";
import type { Kysely } from "kysely";

import type { Database } from "../app/database/types.ts";
import { BASE_PATH, expect, signIn, test } from "./fixtures.ts";

// The layout comes from KERN's grid and helper classes, which unit tests can only check by class
// name. These specs look at the boxes the browser makes of them. They assert structure (no overflow,
// no overlap, side by side or stacked, capped widths), not pixels, so there are no screenshot
// baselines to maintain.

const WIDTHS = [
  { name: "phone", width: 320 },
  { name: "tablet", width: 768 },
  { name: "laptop", width: 1280 },
  { name: "wide screen", width: 1920 },
] as const;

const LG = 992;
const REM = 16;

async function useWidth(page: Page, width: number) {
  await page.setViewportSize({ width, height: 900 });
}

async function expectNoHorizontalScroll(page: Page, where: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(scrollWidth, `${where} is wider than the viewport`).toBeLessThanOrEqual(clientWidth);
}

async function box(page: Page, selector: string, index = 0) {
  const target = page.locator(selector).nth(index);
  await expect(target).toBeVisible();
  return (await target.boundingBox())!;
}

async function seedOpenTerminumfrage(db: Kysely<Database>, userId: string) {
  const { id, universal_token } = await db
    .insertInto("appointment")
    .values({
      user_id: userId,
      aktenzeichen: "574 C 65412/26",
      status: "open",
      universal_token: randomUUID(),
    })
    .returning(["id", "universal_token"])
    .executeTakeFirstOrThrow();
  await db
    .insertInto("time_slot")
    .values([
      { appointment_id: id, start_time: "2099-11-09T14:30:00Z", end_time: "2099-11-09T17:00:00Z" },
      { appointment_id: id, start_time: "2099-11-13T08:00:00Z", end_time: "2099-11-13T12:00:00Z" },
    ])
    .execute();
  return { id, token: universal_token! };
}

for (const { name, width } of WIDTHS) {
  test.describe(`at ${width}px (${name})`, () => {
    test("the public pages do not scroll sideways", async ({ page, users, db }) => {
      const judge = await users.create({ roles: ["richter"] });
      const { token } = await seedOpenTerminumfrage(db, judge.id);
      await useWidth(page, width);

      for (const path of ["/", `/umfrage/${token}`, "/gibt-es-nicht"]) {
        await page.goto(`${BASE_PATH}${path}`);
        await expectNoHorizontalScroll(page, path);
      }
    });

    test("the signed-in pages do not scroll sideways", async ({ page, users, db }) => {
      const judge = await users.create({ roles: ["richter"] });
      const { id } = await seedOpenTerminumfrage(db, judge.id);
      await signIn(page, judge);
      await useWidth(page, width);

      for (const path of [
        "/overview",
        `/overview/${id}`,
        `/overview/${id}/select`,
        "/overview/new",
        "/kalender-abonnieren",
      ]) {
        await page.goto(`${BASE_PATH}${path}`);
        await expectNoHorizontalScroll(page, path);
      }
    });

    test("the admin pages do not scroll sideways", async ({ page, users }) => {
      const admin = await users.createAdmin();
      await signIn(page, admin);
      await useWidth(page, width);

      for (const path of ["/admin/users", "/admin/domains"]) {
        await page.goto(`${BASE_PATH}${path}`);
        await expectNoHorizontalScroll(page, path);
      }
    });

    test("the footer cells stay apart", async ({ page }) => {
      await useWidth(page, width);
      await page.goto(`${BASE_PATH}/`);

      const legal = await box(page, "footer nav[aria-labelledby=footer-legal]");
      const contact = await box(page, "footer nav[aria-labelledby=footer-contact]");

      if (width >= LG) {
        // Side by side, with the gap of the grid between them.
        expect(legal.y).toBeCloseTo(contact.y, 0);
        expect(contact.x - (legal.x + legal.width)).toBeGreaterThanOrEqual(REM - 1);
      } else {
        // Stacked, in one column.
        expect(contact.y).toBeGreaterThanOrEqual(legal.y + legal.height);
      }
    });

    test("a form field keeps the width of the design", async ({ page, users }) => {
      await signIn(page, await users.create({ roles: ["richter"] }));
      await useWidth(page, width);
      await page.goto(`${BASE_PATH}/overview/new`);

      const field = await box(page, ".field-column--small");
      // 27rem, and never wider than the screen.
      expect(field.width).toBeLessThanOrEqual(27 * REM + 1);
      expect(field.x + field.width).toBeLessThanOrEqual(width);
      if (width >= 768) expect(field.width).toBeGreaterThan(20 * REM);
    });
  });
}

test("the navigation stands beside the content from lg and above it below", async ({
  page,
  users,
}) => {
  await signIn(page, await users.create({ roles: ["richter"] }));

  for (const width of [LG - 1, LG]) {
    await useWidth(page, width);
    await page.goto(`${BASE_PATH}/overview`);
    const nav = await box(page, ".sidebar-page nav[aria-label=Bereiche]");
    const content = await box(page, ".sidebar-page > .kern-row > .kern-grid-col:nth-child(2)");

    if (width >= LG) {
      expect(nav.x + nav.width).toBeLessThanOrEqual(content.x);
      expect(nav.y).toBeCloseTo(content.y, 0);
    } else {
      expect(content.y).toBeGreaterThanOrEqual(nav.y + nav.height);
    }
  }
});

test("the survey form stands beside the Aktenzeichen from lg and below it under lg", async ({
  page,
  users,
  db,
}) => {
  const { token } = await seedOpenTerminumfrage(db, (await users.create()).id);

  for (const width of [LG - 1, LG]) {
    await useWidth(page, width);
    await page.goto(`${BASE_PATH}/umfrage/${token}`);
    const aktenzeichen = await box(page, "dl");
    const form = await box(page, "form");

    if (width >= LG) {
      expect(aktenzeichen.x + aktenzeichen.width).toBeLessThanOrEqual(form.x);
    } else {
      expect(form.y).toBeGreaterThanOrEqual(aktenzeichen.y + aktenzeichen.height);
    }
  }
});

test("a grid cell has no vertical padding of KERN's own, whatever the order of the stylesheets", async ({
  page,
  users,
}) => {
  await signIn(page, await users.create({ roles: ["richter"] }));
  await page.goto(`${BASE_PATH}/overview`);

  const paddings = await page.locator(".kern-row > .kern-grid-col").evaluateAll((cells) =>
    cells.map((cell) => {
      const { paddingTop, paddingBottom } = getComputedStyle(cell);
      return { paddingTop, paddingBottom };
    }),
  );

  expect(paddings.length).toBeGreaterThan(0);
  for (const padding of paddings) {
    expect(padding).toEqual({ paddingTop: "0px", paddingBottom: "0px" });
  }
});

test("the steps of the front page stay a list for assistive technology", async ({ page }) => {
  await page.goto(`${BASE_PATH}/`);

  const steps = page.locator("ol.welcome__steps");
  await expect(steps).toHaveAttribute("role", "list");
  await expect(
    page.getByRole("list").filter({ has: page.locator("li.welcome__step") }),
  ).toHaveCount(1);
});
