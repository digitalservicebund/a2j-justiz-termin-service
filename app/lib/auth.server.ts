import { betterAuth } from "better-auth";
import { magicLink } from "better-auth/plugins";

import { isEmailDomainAllowed } from "../adapters/users/allowed-domains.server.ts";
import { canSignIn } from "../adapters/users/users.server.ts";
import { SELF_SIGNUP_ROLES } from "../core/domain/user.ts";
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
    databaseHooks: {
      user: {
        create: {
          // Only reached when a verified magic link belongs to an address without an
          // account; provisioned users are created by administrators directly.
          async before(user) {
            const email = user.email.trim().toLowerCase();
            if (!(await isEmailDomainAllowed(getDb(), email))) return false;
            return {
              data: {
                ...user,
                email,
                name: user.name || email.split("@")[0],
                // Better Auth sends arrays as JSON, which a text[] column rejects, so pass
                // the Postgres array literal. Role names need no escaping.
                roles: `{${SELF_SIGNUP_ROLES.join(",")}}`,
              },
            };
          },
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: 300,
        storeToken: "hashed",
        async sendMagicLink({ email, url }) {
          // Check here too: callers of the public Better Auth endpoint must not
          // be able to send login mail to addresses outside the user list and
          // the allowed domains.
          if (!(await canSignIn(getDb(), email))) return;

          const transport = createSmtpTransport();
          try {
            await transport.sendMail({
              from: requireSecret("smtp", "SMTP_USER"),
              to: email.trim().toLowerCase(),
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
