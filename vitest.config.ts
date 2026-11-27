import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "~": new URL("./app", import.meta.url).pathname,
      "~tests": new URL("./tests", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["./app/**/*.test.{ts,tsx}", "./tests/**/*.test.{ts,tsx}"],
    pool: "threads",
    setupFiles: ["vitest.setup.ts"],
    // Tests that check logging mock the logger or give it a stream of their own.
    env: { LOG_LEVEL: "silent" },
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html", "json-summary"],
      include: ["app/**/*.{ts,tsx}"],
      exclude: [
        "app/**/*.d.ts",
        "app/routes.ts",
        // Imports a virtual module from the React Router Vite plugin, which Vitest doesn't load,
        // so instrumenting this file breaks test:coverage.
        "app/app.ts",
        "app/database/migrations/**",
        "**/*.test.{ts,tsx}",
      ],
    },
  },
});
