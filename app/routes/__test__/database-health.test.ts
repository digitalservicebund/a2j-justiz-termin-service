import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type KyselyPlugin,
} from "kysely";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "~/database/database";
import type { Database } from "~/database/types";
import { loader } from "../database-health";

vi.mock("~/database/database", () => ({ getDb: vi.fn() }));

function dbWithResult(plugin: KyselyPlugin) {
  return new Kysely<Database>({
    dialect: {
      createAdapter: () => new PostgresAdapter(),
      createDriver: () => new DummyDriver(),
      createIntrospector: (db) => new PostgresIntrospector(db),
      createQueryCompiler: () => new PostgresQueryCompiler(),
    },
    plugins: [plugin],
  });
}

describe("GET /health/database", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the database time when the query succeeds", async () => {
    const now = new Date("2026-10-14T10:00:00.000Z");
    vi.mocked(getDb).mockReturnValue(
      dbWithResult({
        transformQuery: ({ node }) => node,
        transformResult: async ({ result }) => ({ ...result, rows: [{ now }] }),
      }),
    );

    const response = await loader();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: "ok",
      databaseTime: now.toISOString(),
    });
  });

  it("returns 503 without leaking details when the query fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getDb).mockReturnValue(
      dbWithResult({
        transformQuery: ({ node }) => node,
        transformResult: async () => {
          throw new Error("password authentication failed for user jts");
        },
      }),
    );

    const response = await loader();

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "error" });
  });
});
