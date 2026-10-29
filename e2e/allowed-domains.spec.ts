import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import {
  BASE_PATH,
  baseURL,
  expect,
  issueMagicLink,
  messages,
  readMagicLink,
  signIn,
  test,
} from "./fixtures.ts";

function addDomain(value: string) {
  return execFileSync(process.execPath, ["scripts/add-domain.ts", "--domain", value], {
    stdio: "pipe",
  });
}

async function requestLink(page: Page, email: string) {
  await page.goto(`${BASE_PATH}/`);
  await page.getByRole("textbox", { name: "E-Mail-Adresse" }).fill(email);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
}

test("an address on an allowed domain signs up with a verified magic link", async ({
  page,
  request,
  users,
  db,
}) => {
  const domain = await users.allowedDomain();
  const email = users.email(domain);
  await requestLink(page, email);
  await expect(page.getByRole("status")).toContainText("Ihr Anmelde-Link wurde versendet");
  await expect(page.getByRole("status")).toBeFocused();
  await expect(page.getByRole("textbox", { name: "E-Mail-Adresse" })).toHaveValue(email);
  // The account only exists once the link was opened.
  expect(await db.selectFrom("user").select("id").where("email", "=", email).execute()).toEqual([]);

  await page.getByRole("button", { name: "Anmelde-Link erneut senden." }).click();
  await expect.poll(async () => (await messages(request, email)).length).toBe(2);

  await page.goto(await readMagicLink(request, email));
  await expect(page).toHaveURL(`${baseURL}/overview`);
  const user = await db
    .selectFrom("user")
    .select(["name", "email", "emailVerified", "roles"])
    .where("email", "=", email)
    .executeTakeFirstOrThrow();
  expect(user).toEqual({
    name: email.split("@")[0],
    email,
    emailVerified: true,
    roles: ["richter"],
  });
  expect((await page.request.get(`${BASE_PATH}/admin/users`)).status()).toBe(403);
});

test("the API only sends links to provisioned users and allowed domains", async ({
  request,
  users,
}) => {
  const allowed = users.email(await users.allowedDomain());
  const other = users.email();
  await issueMagicLink(request, allowed);
  const response = await request.post(`${BASE_PATH}/api/auth/sign-in/magic-link`, {
    data: { email: other },
  });
  expect(response.status()).toBe(200);
  expect(await messages(request, other)).toEqual([]);
});

test("a link for an address whose domain was removed meanwhile creates no account", async ({
  page,
  request,
  users,
  db,
}) => {
  const domain = await users.allowedDomain();
  const email = users.email(domain);
  const link = await issueMagicLink(request, email);
  await db.deleteFrom("allowed_domain").where("domain", "=", domain).execute();
  await page.goto(link);
  await expect(page).toHaveURL(/\/\?error=/);
  await expect(page.getByRole("alert").filter({ hasText: "Ungültiger Anmeldelink" })).toBeVisible();
  expect(await db.selectFrom("user").select("id").where("email", "=", email).execute()).toEqual([]);
});

test("a provisioned user outside the allowed domains keeps signing in", async ({
  page,
  request,
  users,
}) => {
  const user = await users.create();
  await requestLink(page, user.email);
  await expect(page.getByRole("status")).toContainText("Ihr Anmelde-Link wurde versendet");
  expect((await messages(request, user.email)).length).toBe(1);
});

test("an administrator can allow and remove domains through the UI", async ({
  page,
  users,
  db,
}) => {
  const admin = await users.createAdmin();
  await signIn(page, admin);
  await page.goto(`${BASE_PATH}/admin/domains`);
  const domain = `e2e-${randomUUID()}.example.com`;
  users.domains.add(domain);
  const stored = () =>
    db.selectFrom("allowed_domain").select("domain").where("domain", "=", domain).execute();

  const form = page.getByRole("region", { name: "Domain hinzufügen", exact: true });
  await form.getByRole("textbox", { name: "Domain" }).fill(` ${domain.toUpperCase()} `);
  await form.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(page.getByRole("alert")).toContainText("Gespeichert");
  expect(await stored()).toEqual([{ domain }]);
  const entry = page.getByRole("region", { name: domain, exact: true });
  await expect(entry).toBeVisible();

  await form.getByRole("textbox", { name: "Domain" }).fill(domain);
  await form.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(page.getByRole("alert")).toContainText("Diese Domain ist bereits freigegeben.");

  await form.getByRole("textbox", { name: "Domain" }).fill("person@example.com");
  await form.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(page.getByRole("alert")).toContainText("Bitte geben Sie eine gültige Domain ein");

  await entry.getByRole("button", { name: "Domain entfernen" }).click();
  await expect(entry).toHaveCount(0);
  expect(await stored()).toEqual([]);

  const crossOrigin = await page.request.post(`${BASE_PATH}/admin/domains`, {
    form: { intent: "create", domain },
    headers: { Origin: "https://untrusted.example" },
  });
  expect(crossOrigin.status()).toBe(400);
  expect(await stored()).toEqual([]);
});

test("only administrators can manage domains", async ({ page, request, users }) => {
  const anonymous = await request.get(`${BASE_PATH}/admin/domains`, { maxRedirects: 0 });
  expect(anonymous.status()).toBe(302);
  await signIn(page, await users.create());
  expect((await page.request.get(`${BASE_PATH}/admin/domains`)).status()).toBe(403);
  const create = await page.request.post(`${BASE_PATH}/admin/domains`, {
    form: { intent: "create", domain: "example.org" },
  });
  expect(create.status()).toBe(403);
});

test("the CLI allows a domain once and rejects duplicates and invalid domains", async ({
  users,
  db,
}) => {
  const domain = `e2e-${randomUUID()}.example.com`;
  users.domains.add(domain);
  addDomain(domain.toUpperCase());
  expect(
    await db.selectFrom("allowed_domain").select("domain").where("domain", "=", domain).execute(),
  ).toEqual([{ domain }]);
  expect(() => addDomain(domain)).toThrow();
  expect(() => addDomain("person@example.com")).toThrow();
});
