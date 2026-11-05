import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";

import { defineConfig, devices } from "@playwright/test";

import { BASE_PATH } from "./app/lib/base-path.ts";
import { requireEnv } from "./app/lib/env.ts";

// e2e/run.sh points E2E_ENV_FILE at a copy with shifted ports when it runs in a worktree slot.
const environmentFile = process.env.E2E_ENV_FILE ?? new URL("./.env.e2e", import.meta.url);
const environment = parseEnv(readFileSync(environmentFile, "utf8"));
Object.assign(process.env, environment);
const baseURL = requireEnv("BASE_URL");

function findLocalChrome(): string | undefined {
  const knownPaths = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
  ];
  const knownPath = knownPaths.find((path) => existsSync(path));
  if (knownPath) return knownPath;

  for (const command of ["google-chrome", "google-chrome-stable"]) {
    const result = spawnSync("which", [command], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  return undefined;
}

const chromePath = findLocalChrome();

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  workers: 1,
  timeout: 30_000,
  // On CI the github reporter turns each failure into an annotation on the pull request.
  reporter: [
    ["list"],
    ["html", { open: "never" }],
    ...(process.env.CI ? [["github"] as const] : []),
  ],
  use: {
    baseURL,
    // The app has to work without JavaScript, so every spec runs with it switched off.
    javaScriptEnabled: false,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    extraHTTPHeaders: { Origin: baseURL, "X-Forwarded-For": "198.18.0.1" },
  },
  projects: [
    {
      name: chromePath ? "chrome" : "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(chromePath ? { channel: "chrome", launchOptions: { executablePath: chromePath } } : {}),
      },
    },
  ],
  webServer: {
    command: "node server.js",
    url: `${baseURL}${BASE_PATH}/health`,
    reuseExistingServer: false,
    timeout: 60_000,
    gracefulShutdown: { signal: "SIGTERM", timeout: 5_000 },
  },
});
