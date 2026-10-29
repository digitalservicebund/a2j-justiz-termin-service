import { BASE_PATH, baseURL, expect, signIn, test } from "./fixtures.ts";

test("the bare host redirects to the app, everything else outside the base path is not found", async ({
  request,
}) => {
  const root = await request.get("/", { maxRedirects: 0 });
  expect(root.status()).toBe(302);
  expect(root.headers().location).toBe(BASE_PATH);

  for (const path of [
    "/overview",
    "/umfrage/token",
    "/api/auth/get-session",
    "/assets/missing.js",
  ]) {
    expect((await request.get(path, { maxRedirects: 0 })).status(), path).toBe(404);
  }
});

test("pages load their assets and icons from under the base path", async ({ page }) => {
  const failed: string[] = [];
  const assets: string[] = [];
  page.on("response", (response) => {
    const { pathname } = new URL(response.url());
    if (pathname.includes("/assets/")) assets.push(pathname);
    if (!response.ok()) failed.push(`${response.status()} ${pathname}`);
  });

  await page.goto(`${BASE_PATH}/`);
  await page.waitForLoadState("networkidle");

  expect(assets.length).toBeGreaterThan(0);
  for (const pathname of assets) expect(pathname.startsWith(`${BASE_PATH}/assets/`)).toBe(true);
  expect(failed).toEqual([]);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    `${BASE_PATH}/site.webmanifest`,
  );
  const manifest = await page.request.get(`${BASE_PATH}/site.webmanifest`);
  expect(manifest.status()).toBe(200);
  expect((await page.request.get(`${BASE_PATH}/icon-192.png`)).status()).toBe(200);
});

test("the breadcrumb start page link stays under the base path", async ({ page, users }) => {
  await signIn(page, await users.create());
  await expect(page.getByRole("link", { name: "Startseite" })).toHaveAttribute("href", BASE_PATH);
});

test("the session cookie is named and scoped for this app", async ({ page, users }) => {
  await signIn(page, await users.create());
  const cookies = await page.context().cookies(baseURL);
  const session = cookies.find((cookie) => cookie.name === "jts.session_token");
  expect(session?.path).toBe(BASE_PATH);
  expect(cookies.filter((cookie) => cookie.path !== BASE_PATH)).toEqual([]);
  expect(cookies.some((cookie) => cookie.name.startsWith("better-auth"))).toBe(false);
});

// LEGACY: delete this test together with app/lib/legacy-health.ts, see the clean-up steps there.
test("the health checks answer under the base path and, for now, at their old URLs", async ({
  request,
}) => {
  for (const path of ["/health", "/health/database", "/health/smtp"]) {
    for (const url of [`${BASE_PATH}${path}`, path]) {
      const response = await request.get(url);
      expect(response.status(), url).toBe(200);
    }
  }
  expect(await (await request.get(`${BASE_PATH}/health`)).json()).toEqual({ status: "ok" });
});
