import { parseArgs } from "node:util";

import { insertAllowedDomain } from "../app/adapters/users/allowed-domains.server.ts";
import { getDb } from "../app/database/database.ts";
import { migrateToLatest } from "../app/database/migrate.ts";
import { CLI_ACTOR, log } from "../app/lib/infra/logging.ts";

try {
  const { values } = parseArgs({ options: { domain: { type: "string" } } });
  await migrateToLatest();
  const { domain } = await insertAllowedDomain(getDb(), CLI_ACTOR, values.domain ?? "");
  log.info({ domain }, "domain allowed; its addresses can now request a login link");
} catch (error) {
  log.error({ err: error }, "could not allow domain; usage: pnpm domain:add --domain <domain>");
  process.exitCode = 1;
} finally {
  await getDb().destroy();
}
