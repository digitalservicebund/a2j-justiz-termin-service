import type { Kysely } from "kysely";

import {
  compareSitzungstage,
  isWeekday,
  type Sitzungstag,
  type SitzungstagTimes,
} from "../../core/domain/sitzungstag.ts";
import { fromSqlTime, toSqlTime } from "../../core/domain/time/time-of-day.ts";
import type { Database } from "../../database/types.ts";

type Row = { id: string; weekday: number; start_time: string; end_time: string };

function toSitzungstag({ id, weekday, start_time, end_time }: Row): Sitzungstag {
  // The database only holds 1 to 5, so anything else is a broken row.
  if (!isWeekday(weekday)) throw new Error(`Sitzungstag ${id} has weekday ${weekday}`);
  return { id, weekday, start: fromSqlTime(start_time), end: fromSqlTime(end_time) };
}

const columns = ["id", "weekday", "start_time", "end_time"] as const;

const toRow = ({ weekday, start, end }: SitzungstagTimes) => ({
  weekday,
  start_time: toSqlTime(start),
  end_time: toSqlTime(end),
});

// The judge's Sitzungstage, by weekday and start time.
export async function listSitzungstage(db: Kysely<Database>, userId: string) {
  const rows = await db
    .selectFrom("sitzungstag")
    .select(columns)
    .where("user_id", "=", userId)
    .execute();
  return rows.map(toSitzungstag).sort(compareSitzungstage);
}

export async function addSitzungstag(
  db: Kysely<Database>,
  userId: string,
  times: SitzungstagTimes,
): Promise<Sitzungstag> {
  const row = await db
    .insertInto("sitzungstag")
    .values({ user_id: userId, ...toRow(times) })
    .returning(columns)
    .executeTakeFirstOrThrow();
  return toSitzungstag(row);
}

// False when the judge has no Sitzungstag with this id.
export async function updateSitzungstag(
  db: Kysely<Database>,
  userId: string,
  id: string,
  times: SitzungstagTimes,
): Promise<boolean> {
  const result = await db
    .updateTable("sitzungstag")
    .set({ ...toRow(times), updated_at: new Date() })
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return result.numUpdatedRows > 0n;
}

// False when the judge has no Sitzungstag with this id.
export async function deleteSitzungstag(
  db: Kysely<Database>,
  userId: string,
  id: string,
): Promise<boolean> {
  const result = await db
    .deleteFrom("sitzungstag")
    .where("id", "=", id)
    .where("user_id", "=", userId)
    .executeTakeFirst();
  return result.numDeletedRows > 0n;
}
