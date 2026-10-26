import { parseArgs } from "node:util";

import { insertAllowedDomain } from "../app/adapters/users/allowed-domains.server.ts";
import { getDb } from "../app/database/database.ts";
import { migrateToLatest } from "../app/database/migrate.ts";
import { logError, logInfo } from "../app/lib/logging.ts";

try {
  const { values } = parseArgs({ options: { domain: { type: "string" } } });
  await migrateToLatest();
  const { domain } = await insertAllowedDomain(getDb(), values.domain ?? "");
  logInfo(`Domain ${domain} allowed. Its addresses can now request a login link.`);
} catch (error) {
  logError("Could not allow domain. Usage: pnpm domain:add --domain <domain>", error);
  process.exitCode = 1;
} finally {
  await getDb().destroy();
}
