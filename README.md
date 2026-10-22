# Justiz Termin Service (JTS)

**This application is currently a prototype/proof of concept and not meant for production.**

Production access logs record request paths without query strings, keeping
sensitive query parameters out of those logs.

- **Richter** (judge): creates and edits time slots, confirms the final appointment, can unlock party re-submission
- **Kläger** (plaintiff): accepts/rejects each proposed time slot
- **Beklagter** (defendant): accepts/rejects each proposed time slot

Login uses a single-use magic link sent by email through Better Auth. Only users
already provisioned in the database can sign in; public sign-up is disabled.

## Tech Stack

- **Frontend**: React 19 + React Router 7 (SSR)
- **Styling**: KERN UX Native + colocated component CSS
- **Build**: Vite + esbuild
- **Language**: TypeScript 5.9
- **Database**: PostgreSQL 18 + Kysely (query builder and migrations)
- **Package Manager**: pnpm
- **Code Quality**: oxlint + oxfmt
- **Testing**: Vitest + Istanbul coverage, Playwright Chrome/Chromium E2E

## Prerequisites

- Node.js 26+ (check with `node --version`)
- pnpm (install with `npm install -g pnpm` if needed)
- Docker (or another container runtime with `docker compose`) for the local database and mail mock
- lefthook (install with `lefthook install`)

## Installation

```bash
pnpm install
docker compose up -d   # local PostgreSQL and SMTP mock, see "Database" and "Local SMTP mock" below
pnpm dev
```

## Available Scripts

### Development

```bash
pnpm dev         # Start dev server with Vite + React Router (runs migrations first)
pnpm build       # Build for production (client + SSR)
pnpm start       # Serve production build (runs migrations first)
pnpm typecheck   # Type-check with TypeScript
```

### Database

```bash
pnpm db:migrate     # Apply pending migrations
pnpm psql           # Open psql in the local Postgres container
pnpm docker:reset   # Wipe the local database and start a fresh one
```

### Testing

```bash
pnpm test           # Run unit/component tests once
pnpm test:watch     # Run tests in watch mode
pnpm test:coverage  # Run tests with Istanbul coverage report
pnpm test:e2e       # Build and run isolated Playwright E2E tests (requires Docker)
pnpm test:all       # Run unit/component tests and E2E tests
```

### End-to-end tests

Playwright automatically uses Google Chrome if it is installed in a standard
macOS/Linux location or available as `google-chrome`/`google-chrome-stable` on
`PATH`. Otherwise it uses Playwright's bundled Chromium, which must be installed
once after installing the dependencies:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

On Linux, use `pnpm exec playwright install --with-deps chromium` to install the
browser's OS dependencies too. No real mail credentials or 1Password setup are
needed for E2E tests.

The POSIX shell runner [`e2e/run.sh`](e2e/run.sh) loads the isolated settings from
[`.env.e2e`](.env.e2e). It runs on macOS/Linux; Windows requires Git Bash or WSL.
Keep this file compatible with both POSIX shell assignments and Node's env parser.
It contains public test-only dummy credentials, never real secrets.
The runner starts the dedicated `jts-e2e` Compose project from
the root [`docker-compose.yml`](docker-compose.yml), builds the production app,
and lets Playwright start the server and wait for `/health`. It uses PostgreSQL
on **5544**, SMTP on **1026**, Mailpit on **8026**, and the app on **3109**.
These ports must be free. Container names and the database volume are scoped to
the `jts-e2e` project, separate from development. The runner overrides
`COMPOSE_BIND_ADDRESS`, `POSTGRES_HOST_PORT`, `SMTP_HOST_PORT`, and
`MAILPIT_HOST_PORT`; normal development keeps the root file's default ports.
Tests ignore local/deployed credentials,
use a public test-only signing value, and send mail only to the isolated Mailpit.
The runner removes its containers and database volume after success or failure.

Tests in [`e2e/`](e2e/) cover:

- Welcome-page email submission, mixed-case addresses, delivery
  to Mailpit, email verification, persisted sessions, and logout.
- Unknown-address rejection without account enumeration or outgoing mail,
  hashed tokens, token expiry/replay, invalid links, and unthrottled API/form requests.
- Anonymous access, each scheduling role, admin access, privilege escalation,
  profile updates, and cross-origin management requests.
- CLI administrator provisioning, duplicate rejection, browser-driven user
  creation/editing/deletion, granting/revoking admin rights, session revocation,
  self-removal prevention, and invalidation of deleted users' outstanding links.

Tests use unique addresses, seed their own users, and clean up database rows
and captured mail. They run with one worker. To run a focused test:

```bash
pnpm test:e2e e2e/auth.spec.ts
```

Open the latest report with `pnpm exec playwright show-report`. On failure,
Playwright retains screenshots and traces in `test-results/`. The CI pipeline
uses Google Chrome preinstalled on the `ubuntu-latest` runner, runs the same E2E
command on every pull request and main-branch push, and uploads the report and
failure artifacts. No separate Chromium installation step is needed in CI.
E2E failures block image publication and deployment.

### Code Quality

```bash
pnpm lint:check    # Check code with oxlint
pnpm lint:fix      # Auto-fix oxlint issues
pnpm format:fix    # Format code with oxfmt
pnpm format:check  # Check formatting without writing
```

## Project Structure

```
app/
├── core/                    # Domain logic & architecture
│   ├── domain/             # Business entities (User, Verfahren)
│   ├── ports/              # Repository/Service interfaces
│   └── services/           # SchedulingService, SchedulingQuery
├── adapters/               # External integrations
│   ├── inMemory/           # In-memory scheduling store
│   ├── users/              # Persistent user management
│   └── session/            # Better Auth session and access checks
├── routes/                 # Route modules (React Router)
├── database/               # Kysely, connection pool, migrations (see "Database")
├── lib/                    # Env, secrets and logging helpers
├── components/             # Reusable UI components
│   └── shared/             # Alert, AppNav, Badge, Button, Card, InputRadios
├── app.css                 # KERN Native/font imports + global defaults
├── root.tsx                # Root layout
└── bootstrap.ts            # Dependency injection root
```

Tests live alongside their source in `__test__` subdirectories (e.g. `components/shared/__test__/`).

### Styling

Use documented `@kern-ux/native` component markup and native tokens. KERN-provided
utilities are permitted when their native stylesheet is loaded; Tailwind and
custom utility frameworks are not. Put application-specific rules in a
colocated, component-prefixed stylesheet imported by its owning component.
The application follows the system light/dark preference using KERN's native
theme tokens.

## Database

The app uses **PostgreSQL** with [Kysely](https://kysely.dev/) for type-safe SQL and migrations. Connection code lives in `app/database`. It is not used by the scheduling logic yet, which still runs on the in-memory store.

### Local database

```bash
docker compose up -d      # start Postgres 18 (waits until healthy with --wait)
docker compose ps         # check status
docker compose down       # stop
docker compose down -v    # stop and delete the data volume (same as pnpm docker:reset)
```

Postgres is published on host port **5433**, so it can run next to other projects' databases on 5432.

### Configuration

[`.env.defaults`](.env.defaults) holds the local connection settings and matches `docker-compose.yml`. `pnpm dev`, `pnpm start` and `pnpm db:migrate` load it, plus an optional, git-ignored `.env.local` for overrides.

| Variable                             | Purpose                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `DATABASE_HOST`, `DATABASE_PORT`     | Server address                                                                              |
| `DATABASE_NAME`                      | Database name                                                                               |
| `DATABASE_USER`, `DATABASE_PASSWORD` | Credentials, injected locally (see below for deployed)                                      |
| `DATABASE_SSL_MODE`                  | `verify-full` enables TLS, anything else disables it                                        |
| `SMTP_HOST`, `SMTP_PORT`             | Mail server address                                                                         |
| `SMTP_USER`, `SMTP_PASSWORD`         | Mail credentials, injected locally (see below for deployed)                                 |
| `SMTP_REQUIRE_TLS`                   | `false` skips the STARTTLS requirement (local mock)                                         |
| `SECRETS_FILE_PATH`                  | If set, credentials are read from files instead of env                                      |
| `BASE_URL`                           | Canonical public origin without a trailing slash (local default: `http://localhost:3000`)   |
| `BETTER_AUTH_SECRET`                 | Public local-only dummy by default; deployed signing secret mounted from the secret manager |

In deployed environments the credentials are mounted from the secrets manager as `$SECRETS_FILE_PATH/database/jts_user` and `jts_password`, and the host, port and name come from the ConfigMap generated by the infra repo's Terraform. The SMTP credentials are mounted the same way as `$SECRETS_FILE_PATH/smtp/SMTP_USER` and `SMTP_PASSWORD`, while `SMTP_HOST` and `SMTP_PORT` come from a ConfigMap in the staging overlay.

### Migrations

Migrations are Kysely migration files in `app/database/migrations`. They run automatically on startup (`pnpm dev`, `pnpm start` and the container), or manually with `pnpm db:migrate`. If the database is unreachable, the app does not start.

The initial schema is split deliberately:

- [`0001-auth.ts`](app/database/migrations/0001-auth.ts) uses Kysely's migration
  DSL to reproduce exactly the vanilla PostgreSQL schema generated by Better Auth
  CLI **1.7.10**.
- [`0002-user-management.ts`](app/database/migrations/0002-user-management.ts)
  only adds the application's `roles` text array. The vanilla Better Auth
  columns, defaults, and constraints remain unchanged. Provisioning explicitly
  sets `emailVerified` to `false`; email normalization happens in the application.
  Role names are validated in the application, not constrained in the database.

Keep historical migrations unchanged after deployment; generate new migrations
when upgrading Better Auth or changing the application schema.

**Development reset required:** the initial auth migration was rewritten before
production use. If you applied its earlier version, recreate your local database
with `pnpm docker:reset`, then restart the app and provision your administrator
again. No compatibility migration is provided.

To add one:

1. Copy `app/database/migrations/0001-example.example.txt` to a new `NNNN-<description>.ts` file in the same directory. Use an incrementing, sortable prefix.
2. Adjust `up` and `down`.
3. Add the matching table type to `app/database/types.ts`.
4. Run `pnpm db:migrate`.

The migration files and `server.js` are run directly by Node's TypeScript support, so stick to erasable syntax (no enums or parameter properties) and use `.ts` extensions in imports inside `app/database` and `app/lib`.

### Verifying the connection

`GET /health/database` runs `select now()` and returns `{"status":"ok","databaseTime":"..."}`, or `503` with `{"status":"error"}` if the query fails (details are only logged). It is deliberately separate from `GET /health`, which is the readiness probe and does not touch the database.

```bash
curl localhost:3000/health/database
```

`GET /health/smtp` connects to the SMTP server and authenticates (`verify()`), without sending any mail. It returns `{"status":"ok"}` or `503` with `{"status":"error"}`, and logs the details. Locally it checks the SMTP mock below.

### Local SMTP mock

`docker compose up -d` also starts [Mailpit](https://mailpit.axllent.org/), a catch-all SMTP server that keeps every mail it receives inside the container and never relays anything. `.env.defaults` points the app at it (`localhost:587`, any credentials, no STARTTLS), so nothing you send locally leaves your machine.

- Web UI to read the received mails: http://localhost:8025
- REST API, e.g. `curl localhost:8025/api/v1/messages`
- Mails are lost when the container is removed (`docker compose down`)

To use a real server instead, override the non-secret `SMTP_HOST`, `SMTP_PORT`
and `SMTP_REQUIRE_TLS` settings in `.env.local`. Inject `SMTP_USER` and
`SMTP_PASSWORD` from 1Password, using the same CLI pattern as the auth secret below.

## Authentication

Better Auth stores users, sessions, accounts, and hashed magic-link tokens
in PostgreSQL. The existing SMTP transport sends the links. The public
`/api/auth/*` endpoint and the login form both enforce the maintained user list.
Unknown addresses receive the same confirmation but no email. Links expire after
5 minutes and can only be used once; sessions last 24 hours.
IP-based rate limiting is explicitly disabled. Better Auth 1.7.10's magic-link
plugin has no built-in per-email resend cooldown; email throttling is not
currently implemented.

### Configuration

Set `BASE_URL` to the application's public origin in each environment, including
`http://` or `https://` and without a trailing slash.
It is used to generate emailed links and to validate trusted origins. For a
different local port, override this non-secret setting accordingly.

Local development uses a public dummy signing value from `.env.defaults`, so
sessions survive server restarts. Never use this dummy value in deployed
environments. For deployment, create a random signing secret of at least 32
characters in **1Password**; never put a real secret in source code or an
environment file. Mounted secrets take precedence over the local default.

To override the local dummy value, optionally inject a secret from 1Password using your
own vault/item reference:

```bash
export BETTER_AUTH_SECRET='op://<vault>/<item>/<field>'
op run -- pnpm dev
```

For staging, create a dedicated secret named `better-auth` in the existing STACKIT
Secrets Manager instance, with the property `BETTER_AUTH_SECRET`. Use a new
random value, not an SMTP/database password or HTTP basic-auth credential.
Keep the value in 1Password as the source of truth and provision it into STACKIT.
The infra repo's ExternalSecret syncs that property to Kubernetes Secret
`better-auth-credentials`, mounted read-only at
`$SECRETS_FILE_PATH/better-auth/BETTER_AUTH_SECRET`. The app reads the mounted file,
not a Kubernetes environment variable. Configure this secret and `BASE_URL`
before deploying. All replicas must use the same secret; after rotation, restart
the application pods so their cached auth configuration picks it up. Rotating
the signing secret invalidates existing session cookies.
The SMTP credential is also used as the email's sender address, so configure a
valid sender address for the real mail server.

### Provision the first administrator

There are no default accounts. After starting the local database:

```bash
pnpm user:create-admin --email admin@example.org --name "Administrator"
```

The command runs migrations and creates an administrator; it fails if the
address already exists. It assigns only `admin` and accepts no role options.
Another administrator can change the user's roles in the admin UI, including
removing `admin`; users cannot remove their own administrator access.
In the deployed container, run the equivalent command using its mounted
database credentials:

```bash
node scripts/create-admin.ts --email admin@example.org --name "Administrator"
```

Request a link on the welcome page (`/`), then open the email in
[Mailpit](http://localhost:8025) locally. The account menu links administrators
to `/admin/users`, where they can add users, change names/roles/admin rights,
and delete users. Updating a user revokes their sessions. Deleting one removes
their sessions and outstanding magic links. Email addresses are immutable:
delete and re-create a user to change their address.

Administrators cannot delete their own account or remove their own admin rights.
Each user has a nonempty list containing any combination of `admin`, `richter`,
`klaeger`, and `beklagter`. The home page is an empty placeholder for now. The
`admin` role grants access to every page as well as user management.
All loaders and actions enforce access server-side. The former role-picker
login and development-secret cookie are no longer accepted.

## Mock Calendar Subscription

Subscribe from a calendar application using this URL when running locally:

```text
http://localhost:3000/api/calendars/demo/feed.ics
```

The public `GET /api/calendars/:calendarId/feed.ics` endpoint requires no login.
Replace `demo` with any nonempty, URL-encoded calendar ID occupying one path
segment. The ID is logged with `console.log` and otherwise ignored; every ID
returns the same mock feed. Do not put secrets or personal data in mock IDs.

The feed contains one recurring event, **Test Termin**, every Tuesday from
**13:20 to 14:20 Europe/Berlin**, starting on **13 October 2026**, without an end
date. Its timezone definition preserves Berlin local time across daylight-saving
changes. The event UID and creation timestamp remain fixed across requests.
The event description shows `Last synchronized (feed generated):` followed by
the request's generation time in readable English Berlin local time, for example
`13 October 2026 at 14:00:00 CEST`. The timezone label switches between CET and
CEST automatically. `DTSTAMP` and `LAST-MODIFIED` record the same instant in UTC.
This reports server-side feed generation, not a
confirmed synchronization time in the subscriber's calendar app.

Calendar-level metadata publishes the name **JTS Demo**, the description
**Public mock calendar for Justiz Termin Service.**, and the CSS color name
`midnightblue`. Standard `NAME` and `DESCRIPTION` properties are paired with
`X-WR-CALNAME` and `X-WR-CALDESC` for compatibility.

Responses use `Content-Type: text/calendar; charset=utf-8; method=PUBLISH`,
matching `METHOD:PUBLISH` in the feed, and `Cache-Control: no-store`.
`REFRESH-INTERVAL;VALUE=DURATION:PT5M` and `X-PUBLISHED-TTL:PT5M` suggest a
five-minute minimum polling interval. Clients may ignore or override these hints;
they do not guarantee five-minute updates. Adding the URL as a subscription keeps it
refreshable; downloading and importing the file is a one-time copy, regardless
of metadata.

This endpoint is mock-only: it has no subscriber storage, access control, real
appointments, attendees, event location, or reminders.

## Confirmed Business Rules

- Data stores in memory only (not persisted yet; PostgreSQL connection is set up but unused)
- `Kläger` and `Beklagter` have identical permissions
- Parties submit once by default; locked until `Richter` unlocks
- `Richter` explicitly confirms one mutually accepted slot as final
- Multiple mutually-accepted slots require `Richter` confirmation

## Code Style & Formatting

This project uses **oxfmt** and **oxlint** with automatic fixes on save (IntelliJ + VSCode).

### oxfmt

- Single quotes disabled
- Trailing commas on all
- Import sorting
- Configured in `.oxfmtrc.json`

### oxlint

- TypeScript strict mode
- React/JSX best practices
- A11y (accessibility) rules
- Configured in `.oxlintrc.json`

**Run format + lint together:**

```bash
pnpm format:fix && pnpm lint:fix
```

## Container

### Docker

```bash
docker build -t a2j-justiz-termin-service .
docker run -p 3000:3000 a2j-justiz-termin-service
```

The container runs migrations on startup, so it needs the `DATABASE_*` variables from [Database](#database) and a reachable Postgres. Against the local compose database:

```bash
docker run -p 3000:3000 \
  -e DATABASE_HOST=host.docker.internal -e DATABASE_PORT=5433 \
  -e DATABASE_NAME=a2j-justiz-termin-service \
  -e DATABASE_USER=jts -e DATABASE_PASSWORD=jts \
  a2j-justiz-termin-service
```

### Podman

```bash
podman build -t a2j-justiz-termin-service .
podman run -p 3000:3000 localhost/a2j-justiz-termin-service
```

On macOS, start the Podman machine first if it isn't running:

```bash
podman machine start
```
