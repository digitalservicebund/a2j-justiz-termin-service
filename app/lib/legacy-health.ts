import type { NextFunction, Request, Response } from "express";

import { BASE_PATH } from "./base-path.ts";

const LEGACY_HEALTH_PATH = /^\/health(\/database|\/smtp)?\/?$/;

// LEGACY: the health checks used to live at /health, /health/database and /health/smtp. They now
// live under BASE_PATH, and this middleware keeps the old URLs working so the Kubernetes probes can
// be switched over without downtime.
//
// Clean-up, once the probes use the prefixed URLs and nothing calls the old ones any more:
//   1. In infra, point the liveness, readiness and startup probes at `${BASE_PATH}/health*`.
//   2. Check the access log: no requests to `/health*` without the prefix remain.
//   3. Delete this file, its test (__test__/legacy-health.test.ts) and the
//      `app.use(rewriteLegacyHealthPath)` line in server.js.
export function rewriteLegacyHealthPath(req: Request, _res: Response, next: NextFunction) {
  if (LEGACY_HEALTH_PATH.test(req.path)) {
    // React Router builds its request from originalUrl, so rewrite that as well as url.
    req.url = `${BASE_PATH}${req.url}`;
    req.originalUrl = `${BASE_PATH}${req.originalUrl}`;
  }
  next();
}
