import type { Kysely } from "kysely";

import type { Database } from "../../database/types.ts";

// The court the judge normally works at, as a code of GDS.Gerichte. Null when none is set.
export async function getDefaultCourt(
  db: Kysely<Database>,
  userId: string,
): Promise<string | null> {
  const row = await db
    .selectFrom("richter")
    .select("default_court_code")
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return row?.default_court_code ?? null;
}

// Sets or clears the court the judge normally works at. The row of the judge is written the first
// time.
export async function setDefaultCourt(
  db: Kysely<Database>,
  userId: string,
  courtCode: string | null,
): Promise<void> {
  await db
    .insertInto("richter")
    .values({ user_id: userId, default_court_code: courtCode })
    .onConflict((oc) =>
      oc.column("user_id").doUpdateSet({ default_court_code: courtCode, updated_at: new Date() }),
    )
    .execute();
}
