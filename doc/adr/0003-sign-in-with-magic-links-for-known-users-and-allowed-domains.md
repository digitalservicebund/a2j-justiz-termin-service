# 3. Sign in with magic links for known users and allowed domains

Date: 2026-10-16

## Status

Accepted

## Context

Judges need an account to create and manage a Terminumfrage. Administrators need one to manage users. The first prototype had no real authentication: a role picker on the login page and a development-secret cookie (replaced in [PR #17](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/17)).

Recorded retroactively on 2026-11-08. The date is when the magic-link login was merged. Related: ADR 4 (participant tokens), because participants do not sign in at all.

## Decision

Users sign in with a single-use magic link sent by e-mail, handled by [Better Auth](https://www.better-auth.com/) with its magic-link plugin. Users, sessions and hashed link tokens are stored in PostgreSQL.

- **Who can sign in:** only users who are already provisioned in the database, and anyone with an address on an allowed domain. Domains are exact matches, stored in `allowed_domain` and managed by administrators in `/admin/domains` or with `pnpm domain:add`. The first administrator is created with `pnpm user:create-admin`. There are no default accounts.
- **Self sign-up:** a user from an allowed domain gets an account with the `richter` role only when they open their first link ([PR #46](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/46)). Only the owner of the address can create the account, and removing a domain before that creates nothing.
- **Links and sessions:** a link expires after 5 minutes and works once. A session lasts 24 hours.
- **Roles:** each user has a nonempty list of `admin`, `richter`, `klaeger` and `beklagter`. `admin` grants access to every page. All loaders and actions check access on the server.
- **Responses:** the login form tells an address that is not allowed that it is not allowed. The public `/api/auth/*` endpoint answers every address the same way and sends no mail to addresses that are not allowed.

We chose magic links because users do not have to manage passwords and owning the e-mail address is what proves identity here. No source records a comparison with other login methods or other authentication libraries.

## Consequences

- There are no passwords to store, reset or leak.
- Every sign-in depends on mail delivery. The SMTP transport and its sender address must be configured in each environment, and `/health/smtp` checks the connection.
- All replicas must share the same `BETTER_AUTH_SECRET`. Rotating it ends existing sessions.
- **Accepted risk:** IP-based rate limiting is switched off, and Better Auth's magic-link plugin has no per-email resend cooldown, so nothing limits how often one address can be sent a link. No source records why the IP limit is off. This is acceptable for a prototype that is not meant for production and must be revisited before production use.
- Anyone with an address on an allowed domain can become a `richter`. The list of domains is therefore a security setting.
- Email addresses cannot be changed. To change one, delete and re-create the user.
