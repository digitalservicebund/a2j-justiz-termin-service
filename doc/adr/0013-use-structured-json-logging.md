# 13. Use structured JSON logging

Date: 2026-11-27

## Status

Proposed

## Context

JTS runs on Kubernetes. Until now it wrote plain-text lines to stdout through `console.*` and morgan, and the team read them in ArgoCD. ArgoCD only shows the live tail of a running container: logs are lost when a pod restarts or is replaced, and they cannot be searched, kept or alerted on.

The platform team runs Loki, which collects the stdout of every pod. Loki indexes a few labels that it takes from Kubernetes (namespace, app, pod) and searches everything else in the log line at query time.

Plain-text lines make that search hard: IDs are interpolated into messages, the lines of one request cannot be connected, and nothing tells an operations event apart from an action a user took.

JTS handles data of parties to court proceedings. Logs must not become a second, uncontrolled store of personal data.

## Decision

### Format and transport

- The app writes one JSON object per line to stdout, using **pino**. **pino-http** writes the access log and replaces morgan.
- The app does not ship logs anywhere. Collection, retention and alerting belong to the platform (Loki).
- In development the output is pretty-printed by `pino-pretty`.
- Every line has `level` as a string (`"info"`, `"error"`), `time` as ISO-8601 and `msg`. Identifiers are separate top-level fields in camelCase (`requestId`, `userId`, `appointmentId`, …), not part of the message.
- The level is set with `LOG_LEVEL` (default `info`).

### Request correlation

- Every request gets a `requestId`: the `X-Request-Id` header from the ingress if it is safe to log, or a new UUID. It is returned in the response header.
- The ID is kept in `AsyncLocalStorage`, so every line logged while a request is handled carries it, including lines from loaders, actions and adapters that never see the request.

### Audit events

- Actions of users and administrators are logged with `logAudit(event, fields)`. `event` is a dot-separated name from a typed list (for example `appointment.confirmed`, `user.deleted`).
- Audit lines carry `audit: true`, `event` and `actorId` (`"system"` for automatic actions), so one Loki query returns the audit trail.

### Personal data

- Logs contain opaque IDs only: no e-mail addresses, names, SAFE-IDs, phone numbers, tokens, cookies or client IP addresses.
- The access log names the matched route pattern (`/umfrage/:token/zeitfenster`) instead of the path, so tokens, ids and query strings never get in. No other line logs a path or URL.
- pino redacts known sensitive keys as a safety net.
- Failed database queries log their SQL text, never their parameters.

## Consequences

- Logs can be searched by any field in Loki, and all lines of a request can be found by its `requestId`.
- The audit trail lives in the same stream as the other logs. How long it is kept depends on the platform's Loki retention. If a longer or tamper-proof retention is required, audit lines must be routed to a separate store.
- Developers must use `log` and `logAudit` instead of `console.*`. oxlint's `no-console` rule enforces this.
- Raw JSON is harder to read in ArgoCD than plain text. Loki is the place to read production logs.

## Considered and decided against

- **OpenTelemetry for request correlation.** The Node SDK with the http and pino instrumentations would put `trace_id` and `span_id` on every line and continue incoming `traceparent` headers. We tried it and removed it again. It did not reduce our own code (about 75 lines against about 55 for the `AsyncLocalStorage` context). It added about 90 packages, mostly trace exporters we do not use, and an `--import` flag that every start command needs, or trace ids disappear without an error. It also relies on patching modules as they load, and dev lines had no trace id. It is worth revisiting once traces are exported (Tempo or an OTLP collector), or once Sentry is added, whose Node SDK starts OpenTelemetry anyway. The HTTP spans could then replace the access log.
- **OpenTelemetry logs instead of pino.** The OpenTelemetry logs API is still 0.x and is meant as a bridge for logging libraries, not for application code. It has no JSON-to-stdout output, so logs would have to go over OTLP to a collector. Then `kubectl logs` and ArgoCD would show nothing, and batched lines before a crash would be lost. Redaction would move into the collector, out of this repo. If OTLP logs are wanted later, pino can send them in addition to stdout.
- **Replacing token segments in logged paths.** A list of patterns in our code, with a test that fails for new token routes. Logging the matched route pattern does the same for every route without a list.
- **Our own access log middleware.** pino-http, configured to log with the app logger and our fields, does the same with less code of our own.
