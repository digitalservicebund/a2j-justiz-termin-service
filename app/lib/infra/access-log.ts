import type { IncomingMessage } from "node:http";

import morgan from "morgan";

// Omit every query parameter, including tokens nested inside callback URLs.
morgan.token("safe-path", (request: IncomingMessage) => request.url?.split(/[?#]/, 1)[0] ?? "/");

export const accessLogFormat =
  ":method :safe-path :status :res[content-length] - :response-time ms";
