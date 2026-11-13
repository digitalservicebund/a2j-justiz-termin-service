# 10. Serve the app under one base path

Date: 2026-10-29

## Status

Accepted

## Context

Several applications run under `service.justiz.de` and should appear to visitors as one coherent website. Each application therefore needs its own path prefix on the shared domain.

Recorded retroactively on 2026-11-08. The date is when the prefix was introduced ([PR #54](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/54)). The reason above was given by the team. The pull request itself does not state it.

## Decision

The application is served under `/verhandlungstermin-finder` locally and in every environment, for example `http://localhost:3000/verhandlungstermin-finder/`.

- The prefix is the constant `BASE_PATH` in `app/lib/base-path.ts`. The router basename, Vite base, asset URLs, the Better Auth base path, the cookie path and e-mailed links all derive from it. Changing it is a code change, not configuration.
- The session cookie is named `jts.session_token` and is scoped to the prefix.
- `BASE_URL` is the public origin without the prefix.
- A request for `/` is redirected to the app. Any other path outside the prefix is a 404.
- The health checks also answer at their old unprefixed URLs (`/health*`) so the Kubernetes probes can be switched without downtime. The steps to remove that are in `app/lib/legacy-health.ts`: point the probes at the prefixed URLs, check that the access log shows no unprefixed requests, then delete the middleware.

A separate subdomain per application was not chosen, because the applications should look like one site. The repository does not record whether it was ever evaluated.

## Consequences

- The applications share one domain, so a cookie scoped to the prefix keeps this application's session apart from the others.
- Every absolute URL, in code, mail and infrastructure configuration, has to include the prefix. The routing in front of the application (the reverse proxy) has to send the whole prefix to it.
- Introducing the prefix ended existing sessions (the cookie was renamed) and broke old unprefixed links. Nothing was live at the time.
- The unprefixed health URLs are temporary and have to be removed once the probes use the new ones.
