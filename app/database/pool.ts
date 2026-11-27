import { Pool } from "pg";

import { log } from "../lib/infra/logging.ts";
import { getDBConfig } from "./config.ts";

const dbPoolConfig = {
  max: 10,
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 30000,
  maxUses: 7500,
  statement_timeout: 10000,
} as const;

let poolInstance: Pool | undefined;

export function getPool(): Pool {
  if (poolInstance) {
    return poolInstance;
  }
  poolInstance = new Pool({ ...getDBConfig(), ...dbPoolConfig });
  poolInstance.on("error", (error) => {
    log.error({ err: error }, "unexpected error on idle database client");
  });
  return poolInstance;
}
