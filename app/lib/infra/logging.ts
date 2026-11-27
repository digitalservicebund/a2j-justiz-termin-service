import { AsyncLocalStorage } from "node:async_hooks";

import { pino, type DestinationStream, type Logger, type LoggerOptions } from "pino";

// Structured logging: one JSON object per line on stdout, which the platform's Loki collects.
// Messages are constant; identifiers go into fields (`log.info({ appointmentId }, "…")`).
// Logs hold opaque ids only: no e-mail addresses, names, SAFE-IDs, tokens, links or IP addresses.

type LogContext = { requestId: string };

// server.js and the app build each load their own copy of this module. One storage on globalThis
// lets the context that server.js sets reach the lines the app logs.
const STORAGE_KEY = Symbol.for("jts.logContext");
const globalStorage = globalThis as typeof globalThis & {
  [STORAGE_KEY]?: AsyncLocalStorage<LogContext>;
};
const contextStorage = (globalStorage[STORAGE_KEY] ??= new AsyncLocalStorage<LogContext>());

// Runs `run` with the context of one request: every line logged inside carries its `requestId`.
export function withLogContext<T>(context: LogContext, run: () => T): T {
  return contextStorage.run(context, run);
}

// Keys whose values are personal data or secrets, wherever a caller passes them by mistake.
const SENSITIVE_KEYS = [
  "email",
  "safeId",
  "token",
  "password",
  "authorization",
  "cookie",
  "url",
  "surveyUrl",
];

// Error messages of mail servers and databases can quote the address they rejected.
// Its domain must end in letters, so package paths in stacks (pino@10.4.0/lib/x.js) stay.
const EMAIL = /[\w.+-]+@[a-z\d-]+(?:\.[a-z\d-]+)*\.[a-z]{2,}(?![\w-])/gi;
const scrub = (text: string) => text.replaceAll(EMAIL, "[email]");

const MAX_CAUSE_DEPTH = 5;

// Only the parts of an error that say what went wrong. Other own properties are left out: mail and
// database errors carry recipients, envelopes and row details there.
export function serializeError(value: unknown, depth = 0): unknown {
  if (!(value instanceof Error)) return scrub(String(value));
  const { code } = value as { code?: unknown };
  return {
    type: value.name,
    message: scrub(value.message),
    ...(typeof code === "string" || typeof code === "number" ? { code } : {}),
    ...(value.stack ? { stack: scrub(value.stack) } : {}),
    ...(value.cause !== undefined && depth < MAX_CAUSE_DEPTH
      ? { cause: serializeError(value.cause, depth + 1) }
      : {}),
  };
}

function loggerOptions(level: string): LoggerOptions {
  return {
    level,
    // No pid and hostname: Loki takes the pod from Kubernetes.
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label) => ({ level: label }) },
    // A new object each time: pino merges the line's own fields into it.
    mixin: () => {
      const context = contextStorage.getStore();
      return context ? { requestId: context.requestId } : {};
    },
    serializers: { err: serializeError },
    redact: {
      paths: SENSITIVE_KEYS.flatMap((key) => [key, `*.${key}`]),
      censor: "[redacted]",
    },
  };
}

export function createLogger(level: string, destination?: DestinationStream): Logger {
  return destination ? pino(loggerOptions(level), destination) : pino(loggerOptions(level));
}

// Readable lines in development. pino-pretty is a devDependency, so it is only imported there, and
// as a stream: pino cannot find a transport by name inside Vite's module runner.
async function createAppLogger(): Promise<Logger> {
  const level = process.env.LOG_LEVEL || "info";
  if (process.env.NODE_ENV !== "development") return createLogger(level);
  const { default: pretty } = await import("pino-pretty");
  return createLogger(level, pretty({ sync: true, translateTime: "SYS:HH:MM:ss.l" }));
}

export const log: Logger = await createAppLogger();

// Actions of users, administrators and the system, as the audit trail. Query them in Loki with
// `| json | audit="true"`.
export type AuditEvent =
  | "appointment.created"
  | "appointment.published"
  | "appointment.confirmed"
  | "appointment.cancelled"
  | "participant.removed"
  | "participant.invited"
  | "participant.invitation-pdf-created"
  | "participant.answered"
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "allowed-domain.added"
  | "allowed-domain.removed";

// Who acted: a user id, a participant id, or one of these for actions without a person.
export const SYSTEM_ACTOR = "system";
export const CLI_ACTOR = "cli";

type AuditFields = { actorId: string } & Record<string, string | number | boolean>;

export function logAudit(event: AuditEvent, fields: AuditFields): void {
  log.info({ ...fields, audit: true, event }, event);
}
