import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["./app/**/*.test.{ts,tsx}"],
    pool: "threads",
    setupFiles: ["vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      include: ["app/**/*.{ts,tsx}"],
      exclude: [
        "app/**/*.d.ts",
        "app/routes.ts",
        "app/root.tsx",
        "app/bootstrap.ts",
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
