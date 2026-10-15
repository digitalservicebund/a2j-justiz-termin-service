import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getDBConfig } from "../config";

describe("getDBConfig", () => {
  beforeEach(() => {
    vi.stubEnv("DATABASE_HOST", "localhost");
    vi.stubEnv("DATABASE_PORT", "5433");
    vi.stubEnv("DATABASE_NAME", "jts-db");
    vi.stubEnv("DATABASE_USER", "env-user");
    vi.stubEnv("DATABASE_PASSWORD", "env-password");
    vi.stubEnv("DATABASE_SSL_MODE", "");
    vi.stubEnv("SECRETS_FILE_PATH", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the connection details and credentials from the environment", () => {
    expect(getDBConfig()).toEqual({
      host: "localhost",
      port: 5433,
      user: "env-user",
      password: "env-password",
      database: "jts-db",
      ssl: false,
    });
  });

  it("enables TLS when DATABASE_SSL_MODE is verify-full", () => {
    vi.stubEnv("DATABASE_SSL_MODE", "verify-full");

    expect(getDBConfig().ssl).toBe(true);
  });

  it("throws when a required variable is missing", () => {
    vi.stubEnv("DATABASE_HOST", "");

    expect(() => getDBConfig()).toThrow('"DATABASE_HOST"');
  });

  describe("with mounted secrets", () => {
    let secretsDir: string;

    beforeEach(() => {
      secretsDir = mkdtempSync(path.join(tmpdir(), "secrets-"));
      mkdirSync(path.join(secretsDir, "database"));
      writeFileSync(path.join(secretsDir, "database", "jts_user"), "jts\n");
      writeFileSync(path.join(secretsDir, "database", "jts_password"), "file-password\n");
      vi.stubEnv("SECRETS_FILE_PATH", secretsDir);
    });

    afterEach(() => {
      rmSync(secretsDir, { recursive: true });
    });

    it("prefers the mounted credentials over the environment", () => {
      expect(getDBConfig()).toMatchObject({
        user: "jts",
        password: "file-password",
      });
    });

    it("throws when a secret file is missing", () => {
      rmSync(path.join(secretsDir, "database", "jts_password"));

      expect(() => getDBConfig()).toThrow("jts_password");
    });
  });
});
