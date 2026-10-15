import { Kysely, PostgresDialect } from "kysely";

import { logError } from "../lib/logging.ts";
import { getPool } from "./pool.ts";
import type { Database } from "./types.ts";

let dbInstance: Kysely<Database> | undefined;

export function getDb(): Kysely<Database> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = new Kysely<Database>({
    dialect: new PostgresDialect({ pool: getPool() }),
    log: (event) => {
      if (event.level === "error") {
        logError(`Database query failed: ${event.query.sql}`, event.error);
      }
    },
  });

  return dbInstance;
}
