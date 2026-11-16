import type { NextFunction, Request, Response } from "express";

// Since the app has no file upload, we can limit the body size to:
export const MAX_BODY_BYTES = 64 * 1024; // 64 KiB

// React Router reads the whole body into memory (request.formData()), so reject oversized
// bodies before it sees them.
export function limitRequestBody(req: Request, res: Response, next: NextFunction) {
  const contentLength = req.headers["content-length"];
  const transferEncoding = req.headers["transfer-encoding"];

  if (transferEncoding !== undefined) {
    // With Transfer-Encoding we don't know the length of the body, so reject all of these requests.
    // 411 Length Required: the client has to send a Content-Length instead.
    res.status(411).end();
    return;
  }

  if (contentLength === undefined) {
    // Neither header is set: the request has no body, as with every normal GET e.g.
    next();
    return;
  }

  const bytes = Number(contentLength);
  if (!/^\d+$/.test(contentLength) || !Number.isSafeInteger(bytes)) {
    res.status(400).end();
    return;
  }

  if (bytes > MAX_BODY_BYTES) {
    // Node discards the rest of the unread body without buffering it.
    res.status(413).end();
    return;
  }
  next();
}
