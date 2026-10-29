import { sql } from "kysely";

import { BASE_PATH, expect, issueMagicLink, signIn, startPageURL, test } from "./fixtures.ts";

test("an administrator can downgrade another CLI-provisioned administrator through the UI", async ({
  page,
  users,
  db,
}) => {
  const actor = await users.createAdmin();
  const target = await users.createAdmin();
  await signIn(page, actor);
  await page.goto(`${BASE_PATH}/admin/users`);
  const entry = page.getByRole("region", { name: target.email, exact: true });
  await entry.getByRole("checkbox", { name: "Administratorrechte" }).uncheck();
  await entry.getByRole("checkbox", { name: "Kläger", exact: true }).check();
  await entry.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByRole("alert")).toContainText("Gespeichert");
  expect(
    await db.selectFrom("user").select("roles").where("id", "=", target.id).executeTakeFirst(),
  ).toEqual({ roles: ["klaeger"] });
  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(startPageURL);
  await signIn(page, { ...target, roles: ["klaeger"] });
  expect((await page.request.get(`${BASE_PATH}/admin/users`)).status()).toBe(403);
  expect((await page.request.get(`${BASE_PATH}/overview`)).status()).toBe(200);
});

test("administrator can create, edit, grant/revoke admin rights and delete users through the UI", async ({
  page,
  browser,
  users,
  db,
  extraHTTPHeaders,
}) => {
  const admin = await users.createAdmin();
  await signIn(page, admin);
  await page.goto(`${BASE_PATH}/admin/users`);
  const email = users.email();
  const newUser = page.getByRole("region", { name: "Benutzer hinzufügen", exact: true });
  await newUser.getByRole("textbox", { name: "Name", exact: true }).fill("Managed user");
  await newUser.getByRole("textbox", { name: "E-Mail-Adresse" }).fill(email);
  await newUser.getByRole("checkbox", { name: "Richter", exact: true }).uncheck();
  await newUser.getByRole("checkbox", { name: "Beklagter", exact: true }).check();
  await newUser.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(page.getByRole("alert")).toContainText("Gespeichert");
  const stored = await db
    .selectFrom("user")
    .selectAll()
    .where("email", "=", email)
    .executeTakeFirstOrThrow();
  expect(stored).toMatchObject({ name: "Managed user", roles: ["beklagter"] });
  const entry = page.getByRole("region", { name: email, exact: true });
  await expect(entry).toBeVisible();

  const otherContext = await browser.newContext({ extraHTTPHeaders });
  try {
    const otherPage = await otherContext.newPage();
    await signIn(otherPage, stored);
    expect((await otherPage.request.get(`${BASE_PATH}/admin/users`)).status()).toBe(403);

    await entry.getByRole("textbox", { name: "Name", exact: true }).fill("Updated managed user");
    await entry.getByRole("checkbox", { name: "Beklagter", exact: true }).uncheck();
    await entry.getByRole("checkbox", { name: "Kläger", exact: true }).check();
    await entry.getByRole("checkbox", { name: "Administratorrechte" }).check();
    await entry.getByRole("button", { name: "Speichern" }).click();
    await expect(entry.getByRole("checkbox", { name: "Administratorrechte" })).toBeChecked();
    await expect
      .poll(async () =>
        db
          .selectFrom("user")
          .select(["name", "roles"])
          .where("id", "=", stored.id)
          .executeTakeFirst(),
      )
      .toEqual({ name: "Updated managed user", roles: ["admin", "klaeger"] });
    expect(
      await db.selectFrom("session").select("id").where("userId", "=", stored.id).execute(),
    ).toEqual([]);
    await otherPage.reload();
    await expect(otherPage).toHaveURL(startPageURL);
    await signIn(otherPage, {
      ...stored,
      name: "Updated managed user",
      roles: ["admin", "klaeger"],
    });
    expect((await otherPage.request.get(`${BASE_PATH}/admin/users`)).status()).toBe(200);

    await entry.getByRole("checkbox", { name: "Administratorrechte" }).uncheck();
    await entry.getByRole("button", { name: "Speichern" }).click();
    await expect(entry.getByRole("checkbox", { name: "Administratorrechte" })).not.toBeChecked();
    await expect
      .poll(async () =>
        db.selectFrom("user").select("roles").where("id", "=", stored.id).executeTakeFirst(),
      )
      .toEqual({ roles: ["klaeger"] });
    expect(
      (await otherPage.request.get(`${BASE_PATH}/admin/users`, { maxRedirects: 0 })).status(),
    ).toBe(302);

    const pendingLink = await issueMagicLink(page.request, email);
    await entry.getByRole("button", { name: "Benutzer löschen" }).click();
    await expect(entry).toHaveCount(0);
    expect(await db.selectFrom("user").select("id").where("id", "=", stored.id).execute()).toEqual(
      [],
    );
    expect(
      await db.selectFrom("session").select("id").where("userId", "=", stored.id).execute(),
    ).toEqual([]);
    expect(
      await db
        .selectFrom("verification")
        .select("id")
        .where(sql<string>`"value"::jsonb ->> 'email'`, "=", email)
        .execute(),
    ).toEqual([]);

    await newUser.getByRole("textbox", { name: "Name", exact: true }).fill("Recreated user");
    await newUser.getByRole("textbox", { name: "E-Mail-Adresse" }).fill(email);
    await newUser.getByRole("button", { name: "Hinzufügen" }).click();
    await expect(entry).toBeVisible();
    const recreated = await db
      .selectFrom("user")
      .select("id")
      .where("email", "=", email)
      .executeTakeFirstOrThrow();
    expect(recreated.id).not.toBe(stored.id);
    await otherPage.goto(pendingLink);
    await expect(otherPage).toHaveURL(/\/\?error=INVALID_TOKEN/);
    await expect(
      otherPage.getByRole("alert").filter({ hasText: "Ungültiger Anmeldelink" }),
    ).toBeVisible();
  } finally {
    await otherContext.close();
  }
});

test("management validates duplicates, blocks self-removal and rejects cross-origin mutations", async ({
  page,
  users,
  db,
}) => {
  const admin = await users.createAdmin();
  const user = await users.create();
  await signIn(page, admin);
  await page.goto(`${BASE_PATH}/admin/users`);
  const ownEntry = page.getByRole("region", { name: admin.email, exact: true });
  await expect(ownEntry.getByRole("checkbox", { name: "Administratorrechte" })).toBeDisabled();
  await expect(ownEntry.getByRole("button", { name: "Benutzer löschen" })).toHaveCount(0);

  const newUser = page.getByRole("region", { name: "Benutzer hinzufügen", exact: true });
  await newUser.getByRole("textbox", { name: "Name", exact: true }).fill("Duplicate");
  await newUser.getByRole("textbox", { name: "E-Mail-Adresse" }).fill(user.email);
  await newUser.getByRole("button", { name: "Hinzufügen" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Diese E-Mail-Adresse ist bereits hinterlegt.",
  );
  expect(
    await db.selectFrom("user").select("id").where("email", "=", user.email).execute(),
  ).toEqual([{ id: user.id }]);

  const invalidForms: Array<Record<string, string>> = [
    { intent: "update", id: admin.id, name: admin.name, roles: "klaeger" },
    { intent: "delete", id: admin.id },
    { intent: "create", name: "Invalid role", email: users.email(), roles: "ADMIN" },
  ];
  for (const form of invalidForms) {
    expect((await page.request.post(`${BASE_PATH}/admin/users`, { form })).status()).toBe(400);
  }
  const crossOrigin = await page.request.post(`${BASE_PATH}/admin/users`, {
    form: { intent: "delete", id: user.id },
    headers: { Origin: "https://untrusted.example" },
  });
  expect(crossOrigin.status()).toBe(400);
  expect(
    await db.selectFrom("user").select("roles").where("id", "=", admin.id).executeTakeFirst(),
  ).toEqual({ roles: ["admin"] });
  expect(
    await db.selectFrom("user").select("id").where("id", "=", user.id).executeTakeFirst(),
  ).toBeDefined();
});
