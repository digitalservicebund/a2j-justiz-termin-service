import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";

export default defineConfig({
  environments: {
    ssr: {
      build: {
        rollupOptions: { input: "./app/app.ts" },
      },
    },
  },
  plugins: [reactRouter(), devtoolsJson()],
  resolve: { tsconfigPaths: true },
});
