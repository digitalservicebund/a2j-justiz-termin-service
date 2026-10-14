import type { PoolConfig } from "pg";
import { requireEnv } from "../lib/env.ts";
import { requireSecret } from "../lib/secrets.ts";

export function getDBConfig(): Pick<
  PoolConfig,
  "host" | "port" | "user" | "password" | "database" | "ssl"
> {
  return {
    host: requireEnv("DATABASE_HOST"),
    port: Number.parseInt(requireEnv("DATABASE_PORT"), 10),
    user: requireSecret("database", "jts_user", "DATABASE_USER"),
    password: requireSecret("database", "jts_password", "DATABASE_PASSWORD"),
    database: requireEnv("DATABASE_NAME"),
    ssl: process.env.DATABASE_SSL_MODE === "verify-full",
  };
}
