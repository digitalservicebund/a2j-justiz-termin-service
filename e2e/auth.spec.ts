import { sql } from "kysely";

import {
  BASE_PATH,
  expect,
  issueMagicLink,
  messages,
  signIn,
  startPageURL,
  test,
} from "./fixtures.ts";

test("landing-page login proves email ownership, creates a session, and logout revokes it", async ({
  page,
  request,
  users,
  db,
}) => {
  const user = await users.create();
  const link = await signIn(page, user);
  const stored = await db
    .selectFrom("user")
    .selectAll()
    .where("id", "=", user.id)
    .executeTakeFirstOrThrow();
  expect(stored.emailVerified).toBe(true);
  const sessions = await db
    .selectFrom("session")
    .selectAll()
    .where("userId", "=", user.id)
    .execute();
  expect(sessions).toHaveLength(1);
  expect(sessions[0]!.expiresAt.getTime() - sessions[0]!.createdAt.getTime()).toBeCloseTo(
    24 * 60 * 60 * 1000,
    -3,
  );
  const cookies = await page.context().cookies();
  const sessionCookie = cookies.find((cookie) => cookie.name.endsWith("session_token"));
  expect(sessionCookie).toMatchObject({ httpOnly: true, sameSite: "Lax" });

  expect((await page.request.get(`${BASE_PATH}/?index&intent=logout`)).status()).toBe(200);
  expect(
    (
      await page.request.post(`${BASE_PATH}/?index`, {
        form: { intent: "logout" },
        headers: { Origin: "https://untrusted.example" },
      })
    ).status(),
  ).toBe(400);
  expect(
    await db.selectFrom("session").select("id").where("userId", "=", user.id).execute(),
  ).toHaveLength(1);

  const replay = await request.get(link, { maxRedirects: 0 });
  expect(replay.status()).toBe(302);
  expect(replay.headers().location).toContain("error=INVALID_TOKEN");

  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(startPageURL);
  expect(
    await db.selectFrom("session").select("id").where("userId", "=", user.id).execute(),
  ).toEqual([]);
  const staleCookie = await request.get(`${BASE_PATH}/overview`, {
    headers: { Cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ") },
    maxRedirects: 0,
  });
  expect(staleCookie.status()).toBe(302);
  expect(staleCookie.headers().location).toBe(BASE_PATH);
});

test("unknown addresses are told they are not allowed and get no email or account", async ({
  page,
  request,
  users,
  db,
}) => {
  const email = users.email();
  await page.goto(`${BASE_PATH}/`);
  await page.getByRole("textbox", { name: "E-Mail-Adresse" }).fill(email);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.locator("#login-email-error")).toContainText("können nur ausgewählte Gerichte");
  await expect(page.getByRole("link", { name: "a2j-jts@digitalservice.bund.de" })).toHaveAttribute(
    "href",
    "mailto:a2j-jts@digitalservice.bund.de",
  );
  await expect(page.getByRole("textbox", { name: "E-Mail-Adresse" })).toHaveValue(email);
  await expect(page.getByRole("textbox", { name: "E-Mail-Adresse" })).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByRole("status")).toHaveCount(0);
  expect(await messages(request, email)).toEqual([]);
  expect(await db.selectFrom("user").select("id").where("email", "=", email).execute()).toEqual([]);

  // The public API keeps answering the same way for every address.
  const response = await request.post(`${BASE_PATH}/api/auth/sign-in/magic-link`, {
    data: { email },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: true });
  expect(await messages(request, email)).toEqual([]);
  expect(await db.selectFrom("user").select("id").where("email", "=", email).execute()).toEqual([]);
});

test("invalid addresses are rejected with an error and keep what was typed", async ({
  page,
  request,
}) => {
  await page.goto(`${BASE_PATH}/`);
  await page.getByRole("textbox", { name: "E-Mail-Adresse" }).fill("person@host");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.locator("#login-email-error")).toHaveText(
    "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
  );
  await expect(page.getByRole("textbox", { name: "E-Mail-Adresse" })).toHaveValue("person@host");
  await expect(page.getByRole("textbox", { name: "E-Mail-Adresse" })).toHaveAttribute(
    "aria-invalid",
    "true",
  );

  const invalidForms: Array<Record<string, string>> = [
    { role: "RICHTER" },
    { email: "" },
    { email: "invalid" },
  ];
  for (const form of invalidForms) {
    const invalid = await request.post(`${BASE_PATH}/?index`, { form });
    expect(invalid.status()).toBe(400);
    expect(invalid.headers()["set-cookie"]).toBeUndefined();
  }
});

test("mixed-case email resolves to the provisioned address and tokens are hashed and expire", async ({
  page,
  request,
  users,
  db,
}) => {
  const user = await users.create();
  await signIn(page, user, { uppercase: true });
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(startPageURL);
  const link = await issueMagicLink(request, user.email);
  const token = new URL(link).searchParams.get("token");
  expect(token).toBeTruthy();
  const pending = await db
    .selectFrom("verification")
    .selectAll()
    .where(sql<string>`"value"::jsonb ->> 'email'`, "=", user.email)
    .execute();
  expect(pending).toHaveLength(1);
  expect(pending[0]!.identifier).toMatch(/^magic-link:/);
  expect(pending[0]!.identifier).not.toContain(token);
  expect(pending[0]!.value).not.toContain(token);
  expect(pending[0]!.expiresAt.getTime() - pending[0]!.createdAt.getTime()).toBeCloseTo(
    300_000,
    -3,
  );
  await db
    .updateTable("verification")
    .set({ expiresAt: new Date(Date.now() - 1000) })
    .where("id", "=", pending[0]!.id)
    .execute();
  await page.goto(link);
  await expect(page).toHaveURL(/\/\?error=/);
  await expect(page.getByRole("alert").filter({ hasText: "Ungültiger Anmeldelink" })).toBeVisible();
  expect(
    await db.selectFrom("session").select("id").where("userId", "=", user.id).execute(),
  ).toEqual([]);

  await page.goto(
    `${BASE_PATH}/api/auth/magic-link/verify?token=invalid&errorCallbackURL=${BASE_PATH}/`,
  );
  await expect(page).toHaveURL(/\/\?error=INVALID_TOKEN/);
  await expect(page.getByRole("alert").filter({ hasText: "Ungültiger Anmeldelink" })).toBeVisible();
});

for (const entryPoint of ["API", "form"] as const) {
  test(`does not throttle ${entryPoint} login requests by IP`, async ({ request, users }) => {
    const email = users.email();
    const path =
      entryPoint === "API" ? `${BASE_PATH}/api/auth/sign-in/magic-link` : `${BASE_PATH}/?index`;
    // The form tells unknown addresses they are not allowed; the API always answers 200.
    const expected = entryPoint === "API" ? 200 : 403;
    for (let attempt = 0; attempt < 7; attempt++) {
      const response = await request.post(
        path,
        entryPoint === "API" ? { data: { email } } : { form: { email } },
      );
      expect(response.status()).toBe(expected);
    }
    expect(await messages(request, email)).toEqual([]);
  });
}
