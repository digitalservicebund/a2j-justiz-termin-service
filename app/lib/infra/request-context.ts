import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

import { withLogContext } from "./logging.ts";

const REQUEST_ID_HEADER = "X-Request-Id";

// An id from the ingress is kept only if it cannot break or forge a log line.
const VALID_REQUEST_ID = /^[\w.:-]{1,128}$/;

// Gives every request an id: the ingress's, or a new one. It is sent back in the response and
// carried by every line logged while the request is handled.
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.get(REQUEST_ID_HEADER);
  const requestId = incoming && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  withLogContext({ requestId }, next);
}
