import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "~": new URL("./app", import.meta.url).pathname,
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["./app/**/__test__/**/*.test.{ts,tsx}"],
    pool: "threads",
    setupFiles: ["vitest.setup.ts"],
    coverage: {
      provider: "istanbul",
      reporter: ["text", "html", "json-summary"],
      include: ["app/**/*.{ts,tsx}"],
      exclude: [
        "app/**/*.d.ts",
        "app/routes.ts",
        "app/root.tsx",
        // Imports the React Router server build, which only exists in a Vite build.
        "app/app.ts",
        "app/bootstrap.ts",
        "app/database/migrations/**",
        "app/welcome/**",
        "app/core/ports/**",
        "app/adapters/inMemory/**",
        "**/*.test.{ts,tsx}",
        "**/node_modules/**",
        "**/build/**",
        "**/.react-router/**",
      ],
    },
  },
});
