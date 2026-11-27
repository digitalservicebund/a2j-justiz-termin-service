import { parseArgs } from "node:util";

import { insertUser } from "../app/adapters/users/users.server.ts";
import { NewUserSchema } from "../app/core/domain/user.ts";
import { getDb } from "../app/database/database.ts";
import { migrateToLatest } from "../app/database/migrate.ts";
import { CLI_ACTOR, log } from "../app/lib/infra/logging.ts";

try {
  const { values } = parseArgs({
    options: {
      email: { type: "string" },
      name: { type: "string" },
    },
  });
  const input = NewUserSchema.parse({ ...values, roles: ["admin"] });
  await migrateToLatest();
  const user = await insertUser(getDb(), CLI_ACTOR, input);
  log.info({ userId: user.id }, "administrator created; request a magic link on the login page");
} catch (error) {
  log.error(
    { err: error },
    "could not create administrator; usage: pnpm user:create-admin --email <email> --name <name>",
  );
  process.exitCode = 1;
} finally {
  await getDb().destroy();
}
