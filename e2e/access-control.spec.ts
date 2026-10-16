import { expect, rolePaths, signIn, test } from "./fixtures.ts";

test("anonymous users cannot read protected pages or invoke scheduling and administration actions", async ({
  request,
  users,
  db,
}) => {
  const user = await users.create();
  for (const path of [...Object.values(rolePaths), "/admin/users", "/home"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers().location).toBe("/");
  }
  for (const path of [...Object.values(rolePaths), "/admin/users"]) {
    const response = await request.post(path, {
      form: { intent: "delete", id: user.id },
      maxRedirects: 0,
    });
    expect(response.status()).toBe(302);
  }
  expect(
    await db.selectFrom("user").select("id").where("id", "=", user.id).executeTakeFirst(),
  ).toBeDefined();
});

for (const role of ["richter", "klaeger", "beklagter"] as const) {
  test(`${role} can use their own dashboard but cannot assume another role or administer users`, async ({
    page,
    users,
    db,
  }) => {
    const user = await users.create({ roles: [role] });
    await signIn(page, user);
    expect((await page.request.get(rolePaths[role])).status()).toBe(200);
    await expect(page.getByRole("link", { name: "Benutzerverwaltung" })).toHaveCount(0);
    for (const path of Object.values(rolePaths).filter((path) => path !== rolePaths[role])) {
      expect((await page.request.get(path)).status()).toBe(403);
      expect(
        (await page.request.post(path, { form: { intent: "setSlots", slots: "[]" } })).status(),
      ).toBe(403);
    }

    expect((await page.request.get("/admin/users")).status()).toBe(403);
    expect(
      (
        await page.request.post("/admin/users", { form: { intent: "delete", id: user.id } })
      ).status(),
    ).toBe(403);
    const escalation = await page.request.post("/api/auth/update-user", {
      data: { name: "Escalated", roles: ["admin"] },
    });
    expect(escalation.status()).toBe(400);
    expect(
      await db.selectFrom("user").select("roles").where("id", "=", user.id).executeTakeFirst(),
    ).toEqual({ roles: [role] });
    const profileUpdate = await page.request.post("/api/auth/update-user", {
      data: { name: "Updated profile" },
    });
    expect(profileUpdate.status()).toBe(200);
    expect(
      await db.selectFrom("user").select("name").where("id", "=", user.id).executeTakeFirst(),
    ).toEqual({ name: "Updated profile" });
  });
}

test("multiple roles share a combined overview with creation and response entry points", async ({
  page,
  users,
}) => {
  const user = await users.create({ roles: ["richter", "klaeger", "beklagter"] });
  await signIn(page, user);
  await expect(
    page.getByRole("heading", { name: "Termine erstellen und verwalten" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Auf Terminvorschläge antworten" })).toBeVisible();
  for (const [name, path] of [
    ["Terminplanung öffnen", "/richter"],
    ["Als Kläger antworten", "/klaeger"],
    ["Als Beklagter antworten", "/beklagter"],
  ]) {
    await page.getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await page.getByRole("link", { name: "Übersicht", exact: true }).click();
  }
  expect((await page.request.get("/admin/users")).status()).toBe(403);
});

test("admin-only users can access every scheduling view and manage users", async ({
  page,
  users,
}) => {
  const admin = await users.create({ roles: ["admin"] });
  await signIn(page, admin);
  for (const path of [...Object.values(rolePaths), "/admin/users"]) {
    expect((await page.request.get(path)).status()).toBe(200);
  }
  for (const path of Object.values(rolePaths)) {
    expect((await page.request.post(path, { form: {} })).status()).toBe(200);
  }
  await expect(page.getByRole("link", { name: "Terminplanung öffnen" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Als Kläger antworten" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Als Beklagter antworten" })).toBeVisible();
});
