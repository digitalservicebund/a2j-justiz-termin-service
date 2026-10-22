import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";
import { sql, type Kysely } from "kysely";
import { z } from "zod";

import { insertUser } from "../app/adapters/users/users.server.ts";
import type { AuthUser, NewUserSchema } from "../app/core/domain/user.ts";
import { getDb } from "../app/database/database.ts";
import type { Database } from "../app/database/types.ts";
import { requireEnv } from "../app/lib/env.ts";

export const baseURL = requireEnv("BASE_URL");
const mailpitURL = requireEnv("MAILPIT_URL");

type NewUser = z.infer<typeof NewUserSchema>;

class Users {
  readonly emails = new Set<string>();

  email() {
    const email = `e2e-${randomUUID()}@example.org`;
    this.emails.add(email);
    return email;
  }

  async create(input: Partial<NewUser> = {}): Promise<AuthUser> {
    const email = input.email ?? this.email();
    this.emails.add(email);
    return insertUser(getDb(), {
      email,
      name: "E2E user",
      roles: ["klaeger"],
      ...input,
    });
  }

  async createAdmin(): Promise<AuthUser> {
    const email = this.email();
    execFileSync(process.execPath, [
      "scripts/create-admin.ts",
      "--email",
      email,
      "--name",
      "E2E administrator",
    ]);
    return getDb()
      .selectFrom("user")
      .select(["id", "name", "email", "roles"])
      .where("email", "=", email)
      .executeTakeFirstOrThrow();
  }
}

const messageListSchema = z.object({
  messages: z.array(
    z.object({
      ID: z.string(),
      To: z.array(z.object({ Address: z.string() })),
    }),
  ),
});

export async function messages(request: APIRequestContext, email: string) {
  const response = await request.get(`${mailpitURL}/api/v1/messages`, {
    headers: { Origin: mailpitURL },
  });
  expect(response.status()).toBe(200);
  return messageListSchema
    .parse(await response.json())
    .messages.filter((message) => message.To.some((recipient) => recipient.Address === email));
}

export async function readMagicLink(request: APIRequestContext, email: string): Promise<string> {
  await expect.poll(async () => (await messages(request, email)).length).toBeGreaterThan(0);
  const [message] = await messages(request, email);
  const response = await request.get(`${mailpitURL}/api/v1/message/${message!.ID}`, {
    headers: { Origin: mailpitURL },
  });
  expect(response.status()).toBe(200);
  const mail = z.object({ Text: z.string() }).parse(await response.json());
  const link = mail.Text.match(/https?:\/\/[^\s]+/)?.[0];
  expect(link, "email contains a magic-link verification URL").toBeTruthy();
  const url = new URL(link!);
  expect(url.origin).toBe(baseURL);
  expect(url.pathname).toBe("/api/auth/magic-link/verify");
  return url.href;
}

export async function issueMagicLink(request: APIRequestContext, email: string): Promise<string> {
  const response = await request.post("/api/auth/sign-in/magic-link", {
    data: { email, callbackURL: "/home", errorCallbackURL: "/" },
  });
  expect(response.status()).toBe(200);
  return readMagicLink(request, email.toLowerCase());
}

export const rolePaths = {
  richter: "/richter",
} as const;

export async function signIn(page: Page, user: AuthUser, options = { uppercase: false }) {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "E-Mail-Adresse" })
    .fill(options.uppercase ? user.email.toUpperCase() : user.email);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Bitte prüfen Sie Ihr Postfach" }),
  ).toBeVisible();
  const link = await readMagicLink(page.request, user.email);
  await page.goto(link);
  await expect(page).toHaveURL(`${baseURL}/home`);
  await expect(page.getByRole("navigation", { name: "Benutzerkonto" })).toContainText(user.name);
  return link;
}

export const test = base.extend<{ users: Users }, { db: Kysely<Database> }>({
  db: [
    // Playwright requires destructuring even for dependency-free fixtures.
    // oxlint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const db = getDb();
      await use(db);
      await db.destroy();
    },
    { scope: "worker" },
  ],
  users: [
    async ({ db, request }, use) => {
      const users = new Users();
      try {
        await use(users);
      } finally {
        const emails = [...users.emails];
        if (emails.length) {
          await db.deleteFrom("user").where("email", "in", emails).execute();
          await db
            .deleteFrom("verification")
            .where("identifier", "like", "magic-link:%")
            .where(sql<string>`lower("value"::jsonb ->> 'email')`, "in", emails)
            .execute();
          const ids: string[] = [];
          for (const email of emails)
            ids.push(...(await messages(request, email)).map((mail) => mail.ID));
          if (ids.length) {
            const response = await request.delete(`${mailpitURL}/api/v1/messages`, {
              headers: { Origin: mailpitURL },
              data: { IDs: ids },
            });
            expect(response.ok()).toBe(true);
          }
        }
      }
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
