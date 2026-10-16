import { parseArgs } from "node:util";

import { insertUser } from "../app/adapters/users/users.server.ts";
import { NewUserSchema } from "../app/core/domain/user.ts";
import { getDb } from "../app/database/database.ts";
import { migrateToLatest } from "../app/database/migrate.ts";
import { logError, logInfo } from "../app/lib/logging.ts";

try {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
    },
  });
  const input = NewUserSchema.parse({ ...values, roles: ["admin"] });
  await migrateToLatest();
  const user = await insertUser(getDb(), input);
  logInfo(`Administrator ${user.id} created. Request a magic link on the login page.`);
} catch (error) {
  logError(
    "Could not create administrator. Usage: pnpm user:create-admin --email <email> --name <name>",
    error,
  );
  process.exitCode = 1;
} finally {
  await getDb().destroy();
}
