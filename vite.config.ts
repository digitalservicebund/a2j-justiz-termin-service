import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig({
  environments: {
    ssr: {
      build: {
        rollupOptions: { input: "./app/app.ts" },
      },
    },
  },
  plugins: [reactRouter()],
  resolve: { tsconfigPaths: true },
});
