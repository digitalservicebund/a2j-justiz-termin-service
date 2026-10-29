import compression from "compression";
import express from "express";
import morgan from "morgan";

import { getDb } from "./app/database/database.ts";
import { migrateToLatest } from "./app/database/migrate.ts";
import { accessLogFormat } from "./app/lib/access-log.ts";
import { BASE_PATH } from "./app/lib/base-path.ts";
import { rewriteLegacyHealthPath } from "./app/lib/legacy-health.ts";

// Short-circuit the type-checking of the built output.
const BUILD_PATH = "./build/server/index.js";
const DEVELOPMENT = process.env.NODE_ENV === "development";
const PORT = Number.parseInt(process.env.PORT || "3000");

await migrateToLatest();
// The app code is bundled with its own pool; release the one used for migrating.
await getDb().destroy();

const app = express();
// Trust one hop (the Traefik ingress), which terminates TLS and forwards
// plain HTTP internally. Without this, req.protocol reports "http" while
// the browser's Origin header is "https", which fails React Router's
// single-fetch CSRF origin check and returns 400 on every action request.
app.set("trust proxy", 1);
app.use(compression());
app.disable("x-powered-by");

// We cannot serve a robots.txt at the host root, so keep search engines from indexing any response
// (pages, assets, feeds) with a header instead. Crawlers can only honour it while they may fetch the page.
app.use((_req, res, next) => {
  // Keep in line with the robots meta tag in app/lib/page-meta.ts.
  res.set("X-Robots-Tag", "noindex, nofollow");
  next();
});

// LEGACY: serves the old /health* URLs, see legacy-health.ts for how to remove it.
app.use(rewriteLegacyHealthPath);
// Convenience for visitors of the bare host. Everything else outside BASE_PATH is a 404.
app.get("/", (_req, res) => res.redirect(302, `${BASE_PATH}/`));

if (DEVELOPMENT) {
  // console.log("Starting development server"); // TODO logging
  const viteDevServer = await import("vite").then((vite) =>
    vite.createServer({
      server: { middlewareMode: true },
    }),
  );
  app.use(viteDevServer.middlewares);
  app.use(async (req, res, next) => {
    try {
      const source = await viteDevServer.ssrLoadModule("./app/app.ts");
      return await source.app(req, res, next);
    } catch (error) {
      if (typeof error === "object" && error instanceof Error) {
        viteDevServer.ssrFixStacktrace(error);
      }
      next(error);
    }
  });
} else {
  // console.log("Starting production server"); // TODO logging
  app.use(
    `${BASE_PATH}/assets`,
    express.static("build/client/assets", { immutable: true, maxAge: "1y" }),
  );
  app.use(morgan(accessLogFormat));
  app.use(BASE_PATH, express.static("build/client", { maxAge: "1h" }));
  app.use(await import(BUILD_PATH).then((mod) => mod.app));
}

app.listen(PORT, () => {
  // console.log(`Server is running on http://localhost:${PORT}`); // TODO logging
});
