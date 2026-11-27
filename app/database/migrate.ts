import { promises as fs } from "node:fs";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { FileMigrationProvider, Migrator } from "kysely/migration";

import { log } from "../lib/infra/logging.ts";
import { getDb } from "./database.ts";

export async function migrateToLatest(): Promise<void> {
  const migrator = new Migrator({
    db: getDb(),
    provider: new FileMigrationProvider({
      fs,
      path,
      // Resolved from this file so it works from any working directory.
      migrationFolder: fileURLToPath(new URL("./migrations", import.meta.url)),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === "Success") {
      log.info({ migration: it.migrationName }, "migration executed");
    } else if (it.status === "Error") {
      log.error({ migration: it.migrationName }, "migration failed");
    }
  });

  if (error) {
    throw error;
  }
}

const isExecutedDirectly =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isExecutedDirectly) {
  try {
    await migrateToLatest();
  } catch (error) {
    log.error({ err: error }, "failed to migrate database to latest version");
    process.exitCode = 1;
  } finally {
    await getDb().destroy();
  }
}
