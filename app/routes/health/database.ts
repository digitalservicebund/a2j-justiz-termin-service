import { sql } from "kysely";

import { getDb } from "~/database/database";
import { log } from "~/lib/infra/logging";

// Separate from /health, which backs the readiness probe and must not depend
// on the database.
export async function loader(): Promise<Response> {
  try {
    const { rows } = await sql<{ now: Date }>`select now()`.execute(getDb());
    return Response.json({ status: "ok", databaseTime: rows[0].now });
  } catch (error) {
    log.error({ err: error }, "database health check failed");
    return Response.json({ status: "error" }, { status: 503 });
  }
}
