import { sql } from "kysely";
import { getDb } from "~/database/database";
import { logError } from "~/lib/logging";

// Separate from /health, which backs the readiness probe and must not depend
// on the database.
export async function loader(): Promise<Response> {
  try {
    const { rows } = await sql<{ now: Date }>`select now()`.execute(getDb());
    return Response.json({ status: "ok", databaseTime: rows[0].now });
  } catch (error) {
    logError("Database health check failed", error);
    return Response.json({ status: "error" }, { status: 503 });
  }
}
