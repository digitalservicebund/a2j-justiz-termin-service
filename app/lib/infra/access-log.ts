import type { IncomingMessage, ServerResponse } from "node:http";

import type { Logger } from "pino";
import { pinoHttp } from "pino-http";
import { matchRoutes, type RouteObject } from "react-router";

import { BASE_PATH } from "../web/base-path.ts";
import { log } from "./logging.ts";

// A route of React Router's server build (`build.routes`), keyed by id.
type ManifestRoute = { id: string; parentId?: string; path?: string; index?: boolean };
type RouteManifest = Record<string, ManifestRoute | undefined>;

function routeTree(manifest: RouteManifest, parentId?: string): RouteObject[] {
  return Object.values(manifest)
    .filter((route): route is ManifestRoute => route !== undefined && route.parentId === parentId)
    .map(({ id, path, index }) =>
      index ? { index: true, path } : { path, children: routeTree(manifest, id) },
    );
}

// The route a URL matches, as its pattern: `/umfrage/:token/zeitfenster`, never the token itself
// or the query string. Undefined when no route matches.
export function routePatternMatcher(routes: RouteObject[]) {
  return (url: string): string | undefined => {
    const pathname = url.split(/[?#]/, 1)[0] || "/";
    const matches = matchRoutes(routes, pathname, BASE_PATH);
    if (!matches) return undefined;
    const path = matches
      .map(({ route }) => route.path)
      .filter(Boolean)
      .join("/");
    return `${BASE_PATH}/${path}`;
  };
}

// One line per finished request: request id, method, route pattern, status, time and size. Never the path
// itself, the client's address, headers or cookies. Successful health checks are left out.
export function accessLog(routes: RouteManifest, logger: Logger = log) {
  const routeOf = routePatternMatcher(routeTree(routes));
  const line = (req: IncomingMessage, res: ServerResponse, responseTime: number) => {
    const contentLength = res.getHeader("Content-Length");
    // Set by requestContext. Named here because the line is written after the response, which
    // can be outside the request's log context.
    const { requestId } =
      (res as ServerResponse & { locals?: { requestId?: string } }).locals ?? {};
    return {
      requestId,
      method: req.method,
      route: routeOf(req.url ?? "/") ?? null,
      status: res.statusCode,
      responseTimeMs: responseTime,
      ...(contentLength === undefined ? {} : { contentLength: Number(contentLength) }),
    };
  };

  return pinoHttp({
    logger,
    // Log with the logger itself, not with a child that carries the whole request.
    quietResLogger: true,
    customLogLevel: (req, res, error) => {
      if (error || res.statusCode >= 500) return "error";
      const route = routeOf(req.url ?? "/");
      if (res.statusCode < 400 && route?.startsWith(`${BASE_PATH}/health`)) return "silent";
      return "info";
    },
    customSuccessMessage: () => "request completed",
    customErrorMessage: () => "request failed",
    customSuccessObject: (req, res, { responseTime }) => line(req, res, responseTime as number),
    customErrorObject: (req, res, _error, { responseTime }) =>
      line(req, res, responseTime as number),
  });
}
