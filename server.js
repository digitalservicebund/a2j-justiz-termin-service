import { createTerminus } from "@godaddy/terminus";
import compression from "compression";
import express from "express";

import { getDb } from "./app/database/database.ts";
import { migrateToLatest } from "./app/database/migrate.ts";
import { accessLog } from "./app/lib/infra/access-log.ts";
import { limitRequestBody } from "./app/lib/infra/body-limit.ts";
import { log } from "./app/lib/infra/logging.ts";
import { requestContext } from "./app/lib/infra/request-context.ts";
import { BASE_PATH } from "./app/lib/web/base-path.ts";

// Short-circuit the type-checking of the built output.
const BUILD_PATH = "./build/server/index.js";
const DEVELOPMENT = process.env.NODE_ENV === "development";
const PORT = Number.parseInt(process.env.PORT || "3000");

// Log what nothing else caught, then exit: Kubernetes restarts the pod in a known state.
process.on("uncaughtException", (error) => {
  log.fatal({ err: error }, "uncaught exception");
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  log.fatal({ err: reason }, "unhandled promise rejection");
  process.exit(1);
});

await migrateToLatest();
// The app code is bundled with its own pool; release the one used for migrating.
await getDb().destroy();

const app = express();
// Trust one hop (the Traefik ingress), which terminates TLS and forwards
// plain HTTP internally. Without this, req.protocol reports "http" while
// the browser's Origin header is "https", which fails React Router's
// single-fetch CSRF origin check and returns 400 on every action request.
app.set("trust proxy", 1);
app.use(requestContext);
app.use(compression());
app.disable("x-powered-by");

// We cannot serve a robots.txt at the host root, so keep search engines from indexing any response
// (pages, assets, feeds) with a header instead. Crawlers can only honour it while they may fetch the page.
app.use((_req, res, next) => {
  // Keep in line with the robots meta tag in app/lib/page-meta.ts.
  res.set("X-Robots-Tag", "noindex, nofollow");
  next();
});

// Convenience for visitors of the bare host. Everything else outside BASE_PATH is a 404.
app.get("/", (_req, res) => res.redirect(302, `${BASE_PATH}/`));
// The router's basename ends in a slash (see react-router.config.ts), so the front page only exists
// at BASE_PATH/. Express treats both spellings alike, so compare the path itself.
app.use((req, res, next) => {
  if (req.path !== BASE_PATH) return next();
  const query = req.originalUrl.slice(req.originalUrl.indexOf("?") + 1);
  const hasQuery = req.originalUrl.includes("?");
  return res.redirect(302, `${BASE_PATH}/${hasQuery ? `?${query}` : ""}`);
});
app.use(limitRequestBody);

// Closes what the app holds when the server shuts down; set below for development and production.
let closeConnections = async () => {};

if (DEVELOPMENT) {
  log.info("starting development server");
  const viteDevServer = await import("vite").then((vite) =>
    vite.createServer({
      server: { middlewareMode: true },
    }),
  );
  app.use(viteDevServer.middlewares);
  // Vite reloads the app module when it changes; the background work keeps a single connection.
  (await viteDevServer.ssrLoadModule("./app/app.ts")).startBackgroundWork();
  closeConnections = async () => {
    await (await viteDevServer.ssrLoadModule("./app/app.ts")).closeConnections();
    await viteDevServer.close();
  };
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
  log.info("starting production server");
  app.use(
    `${BASE_PATH}/assets`,
    express.static("build/client/assets", { immutable: true, maxAge: "1y" }),
  );
  const build = await import(BUILD_PATH);
  app.use(accessLog(await build.routeManifest()));
  app.use(BASE_PATH, express.static("build/client", { maxAge: "1h" }));
  build.startBackgroundWork();
  closeConnections = () => build.closeConnections();
  app.use(build.app);
}

const server = app.listen(PORT, () => {
  log.info({ port: PORT }, "server is listening");
});

// On SIGTERM (Kubernetes) or Ctrl-C: stop taking connections, let requests in flight finish (at
// most 25 s, before Kubernetes' default grace period of 30 s ends), close the app's connections,
// exit with 0. Exits with 1 if closing fails.
createTerminus(server, {
  signals: ["SIGTERM", "SIGINT"],
  timeout: 25_000,
  useExit0: true,
  beforeShutdown: async () => log.info("shutting down"),
  onSignal: () => closeConnections(),
  onShutdown: async () => log.info("shutdown complete"),
  logger: (message, error) => log.error({ err: error }, message),
});
