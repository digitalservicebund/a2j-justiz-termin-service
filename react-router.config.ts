import type { Config } from "@react-router/dev/config";

import { BASE_PATH } from "./app/lib/base-path.ts";

export default {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: true,
  // With the trailing slash the router requests the front page's data from `${BASE_PATH}/_.data`.
  // Without it, it asks for `${BASE_PATH}.data`, which the browser sends no session cookie to
  // (Path=BASE_PATH), so client-side visits of the front page showed signed-in users as signed out.
  // server.js redirects the bare BASE_PATH to BASE_PATH/.
  basename: `${BASE_PATH}/`,
} satisfies Config;
