import type { Config } from "@react-router/dev/config";

import { BASE_PATH } from "./app/lib/base-path.ts";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  basename: BASE_PATH,
} satisfies Config;
