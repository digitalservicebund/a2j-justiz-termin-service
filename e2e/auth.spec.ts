import { sql } from "kysely";

import { baseURL, expect, issueMagicLink, messages, signIn, test } from "./fixtures.ts";

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

  expect((await page.request.get("/?index&intent=logout")).status()).toBe(200);
  expect(
    (
      await page.request.post("/?index", {
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
  await expect(page).toHaveURL(`${baseURL}/`);
  expect(
    await db.selectFrom("session").select("id").where("userId", "=", user.id).execute(),
  ).toEqual([]);
  const staleCookie = await request.get("/klaeger", {
    headers: { Cookie: cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ") },
    maxRedirects: 0,
  });
  expect(staleCookie.status()).toBe(302);
  expect(staleCookie.headers().location).toBe("/");
});

test("unknown addresses receive the same confirmation but no email or account", async ({
  page,
  request,
  users,
  db,
}) => {
  const email = users.email();
  await page.goto("/");
  await page.getByRole("textbox", { name: "E-Mail-Adresse" }).fill(email);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Wenn Ihre E-Mail-Adresse hinterlegt ist" }),
  ).toBeVisible();
  const response = await request.post("/api/auth/sign-in/magic-link", { data: { email } });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: true });
  expect(await messages(request, email)).toEqual([]);
  expect(await db.selectFrom("user").select("id").where("email", "=", email).execute()).toEqual([]);

  const invalidForms: Array<Record<string, string>> = [{ role: "RICHTER" }, { email: "invalid" }];
  for (const form of invalidForms) {
    const invalid = await request.post("/?index", { form });
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
  await expect(page).toHaveURL(`${baseURL}/`);
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

  await page.goto("/api/auth/magic-link/verify?token=invalid&errorCallbackURL=/");
  await expect(page).toHaveURL(/\/\?error=INVALID_TOKEN/);
  await expect(page.getByRole("alert").filter({ hasText: "Ungültiger Anmeldelink" })).toBeVisible();
});

for (const entryPoint of ["API", "form"] as const) {
  test(`does not throttle ${entryPoint} login requests by IP`, async ({ request, users }) => {
    const email = users.email();
    const path = entryPoint === "API" ? "/api/auth/sign-in/magic-link" : "/?index";
    for (let attempt = 0; attempt < 7; attempt++) {
      const response = await request.post(
        path,
        entryPoint === "API" ? { data: { email } } : { form: { email } },
      );
      expect(response.status()).toBe(200);
    }
    expect(await messages(request, email)).toEqual([]);
  });
}
