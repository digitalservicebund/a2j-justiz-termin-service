import { readFileSync } from "node:fs";
import path from "node:path";

import { requireEnv } from "./env.ts";

// Reads a secret, throwing when it is missing. Deployed environments mount
// every secret at SECRETS_FILE_PATH/<group>/<fileName> and never as an env var;
// locally it comes from the environment, where the name can differ
// (jts_user vs DATABASE_USER).
export function requireSecret(group: string, fileName: string, envName = fileName): string {
  const secretsPath = process.env.SECRETS_FILE_PATH;
  if (!secretsPath) {
    return requireEnv(envName);
  }

  const filePath = path.resolve(secretsPath, group, fileName);
  let value: string;
  try {
    value = readFileSync(filePath, "utf8").trim();
  } catch (error) {
    throw new Error(`Could not read required secret ${filePath}`, {
      cause: error,
    });
  }
  if (!value) {
    throw new Error(`Required secret ${filePath} is empty`);
  }
  return value;
}
