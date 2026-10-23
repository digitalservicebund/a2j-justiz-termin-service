import { expect, signIn, test } from "./fixtures.ts";

test("anonymous users cannot read protected pages or invoke administration actions", async ({
  request,
  users,
  db,
}) => {
  const user = await users.create();
  for (const path of ["/admin/users", "/overview"]) {
    const response = await request.get(path, { maxRedirects: 0 });
    expect(response.status()).toBe(302);
    expect(response.headers().location).toBe("/");
  }
  const response = await request.post("/admin/users", {
    form: { intent: "delete", id: user.id },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(302);
  expect(
    await db.selectFrom("user").select("id").where("id", "=", user.id).executeTakeFirst(),
  ).toBeDefined();
});

for (const role of ["richter", "klaeger", "beklagter"] as const) {
  test(`${role} cannot administer users or grant themselves admin rights`, async ({
    page,
    users,
    db,
  }) => {
    const user = await users.create({ roles: [role] });
    await signIn(page, user);
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

test("admin-only users can manage users", async ({ page, users }) => {
  const admin = await users.create({ roles: ["admin"] });
  await signIn(page, admin);
  expect((await page.request.get("/admin/users")).status()).toBe(200);
});
