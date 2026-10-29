import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import devtoolsJson from "vite-plugin-devtools-json";

import { BASE_PATH } from "./app/lib/base-path.ts";

export default defineConfig({
  base: `${BASE_PATH}/`,
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
