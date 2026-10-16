import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";

import { getDb } from "../database/database.ts";
import { getAuthSecret } from "./auth-secret.ts";
import { requireEnv } from "./env.ts";
import { logError } from "./logging.ts";
import { requireSecret } from "./secrets.ts";
import { createSmtpTransport } from "./smtp.ts";

function createAuth() {
  return betterAuth({
    appName: "Justiz Termin Service",
    baseURL: requireEnv("BASE_URL"),
    secret: getAuthSecret(),
    database: { db: getDb(), type: "postgres" },
    user: {
      additionalFields: {
        roles: { type: "string[]", required: true, input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24,
      cookieCache: { enabled: false },
    },
    rateLimit: { enabled: false },
    plugins: [
      magicLink({
        disableSignUp: true,
        expiresIn: 300,
        storeToken: "hashed",
        async sendMagicLink({ email, url }) {
          // Check here too: callers of the public Better Auth endpoint must not
          // be able to send login mail to addresses outside the maintained list.
          const user = await getDb()
            .selectFrom("user")
            .select("email")
            .where("email", "=", email.trim().toLowerCase())
            .executeTakeFirst();
          if (!user) return;

          const transport = createSmtpTransport();
          try {
            await transport.sendMail({
              from: requireSecret("smtp", "SMTP_USER"),
              to: user.email,
              subject: "Anmelden beim Justiz Termin Service",
              text: `Mit diesem Link können Sie sich beim Justiz Termin Service anmelden:\n\n${url}\n\nDer Link ist 5 Minuten gültig und kann nur einmal verwendet werden.\nWenn Sie diese Anmeldung nicht angefordert haben, ignorieren Sie diese E-Mail.`,
            });
          } catch (error) {
            logError("Failed to send magic-link email", error);
            throw error;
          } finally {
            transport.close();
          }
        },
      }),
    ],
  });
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth() {
  auth ??= createAuth();
  return auth;
}
