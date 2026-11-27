# Justiz Termin Service (JTS)

**This application is currently a prototype/proof of concept and not meant for production.**

- **Richter** (judge): signs in, creates a Terminumfrage with time slots and a list of
  participants, shares the survey links, and confirms the final slot.
- **Participants** (Kläger, Beklagter and other Verfahrensbeteiligte): do not sign in. They
  answer each proposed time slot through a survey link (`/umfrage/:token`).
- **Administrator**: manages users and allowed domains.

Login uses a single-use magic link sent by email through Better Auth. Only users
already provisioned in the database and addresses on an allowed domain can sign in.

## Tech Stack

- **Frontend**: React 19 + React Router 8 (SSR)
- **Styling**: KERN UX Native + colocated component CSS
- **Build**: Vite + esbuild
- **Language**: TypeScript 7.0
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
docker compose up -d   # local PostgreSQL, SMTP mock and RabbitMQ, see "Database", "Local SMTP mock" and "Local RabbitMQ" below
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
and lets Playwright start the server and wait for `/verhandlungstermin-finder/health`. It uses PostgreSQL
on **5544**, SMTP on **1026**, Mailpit on **8026**, RabbitMQ on **5684** (management UI
**15684**), the fake ERV Versand on **8046**, and the app on **3109**.
These ports must be free. Container names and the database volume are scoped to
the `jts-e2e` project, separate from development. The runner overrides
`COMPOSE_BIND_ADDRESS`, `POSTGRES_HOST_PORT`, `SMTP_HOST_PORT`, `MAILPIT_HOST_PORT`,
`RABBITMQ_HOST_PORT`, `RABBITMQ_MANAGEMENT_HOST_PORT` and `ERV_VERSAND_HOST_PORT`; normal development keeps the root
file's default ports.
Tests ignore local/deployed credentials,
use a public test-only signing value, and send mail only to the isolated Mailpit.
The runner removes its containers and database volume after success or failure.

The app has to work without JavaScript, so Playwright runs every spec with JavaScript
switched off (`javaScriptEnabled: false` in [`playwright.config.ts`](playwright.config.ts)).
Anything that needs JavaScript, such as the copy buttons or opening all review sections at once,
is an enhancement that only appears once the page has hydrated (`useHydrated`). Do not turn
JavaScript back on for a spec; fix the page instead. Lists of inputs cannot grow without
JavaScript, which is why every time slot has a page of its own.

Tests in [`e2e/`](e2e/) cover:

- Welcome-page email submission, mixed-case addresses, delivery
  to Mailpit, email verification, persisted sessions, and logout.
- Rejection of addresses that are neither provisioned nor on an allowed domain (no
  outgoing mail, no account), invalid addresses, hashed tokens, token expiry/replay,
  invalid links, and unthrottled API/form requests.
- Self sign-up from allowed domains, domain management in the admin UI and the
  `domain:add` CLI.
- Anonymous access, each scheduling role, admin access, privilege escalation,
  profile updates, and cross-origin management requests.
- Accessibility: every page, including its error states, passes axe-core's WCAG 2.2 AA rules in
  the light and the dark colour scheme ([`e2e/accessibility.spec.ts`](e2e/accessibility.spec.ts)).
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

### Parallel work with git worktrees

Several people or agents can work on separate branches at the same time, each in its own
[git worktree](https://git-scm.com/docs/git-worktree), without sharing a database, mail catcher,
message broker or port:

```bash
git worktree add ../jts-feature-a -b feat/feature-a
cd ../jts-feature-a
scripts/worktree-setup.sh          # picks the lowest free slot, or pass one: scripts/worktree-setup.sh 3
```

The script writes a git-ignored `.env` with the worktree's slot (1-9), installs the
dependencies and starts that worktree's Compose project. `pnpm dev`, `pnpm db:migrate` and
`docker compose` pick the file up automatically. The main checkout is slot 0 and keeps the
default ports.

| Slot | App    | Postgres | SMTP   | Mailpit | RabbitMQ (UI)    | ERV Versand | Compose project             | `pnpm test:e2e` ports (app / Postgres / SMTP / Mailpit / RabbitMQ / UI / ERV Versand) |
| ---- | ------ | -------- | ------ | ------- | ---------------- | ----------- | --------------------------- | ------------------------------------------------------------------------------------- |
| 0    | 3000   | 5433     | 2525   | 8025    | 5673 (15673)     | 8045        | `a2j-justiz-termin-service` | 3109 / 5544 / 1026 / 8026 / 5684 / 15684 / 8046, project `jts-e2e`                    |
| N    | 3000+N | 5433+N   | 2525+N | 8125+N  | 5673+N (15673+N) | 8145+N      | `jts-slot-N`                | 3109+N / 5544+N / 1026+N / 8026+N / 5684+N / 15684+N / 8046+N, project `jts-e2e-N`    |

`e2e/run.sh` reads the slot from `.env` (or `E2E_SLOT=N pnpm test:e2e`), so E2E runs in different
worktrees do not collide. Each run still starts a full Docker stack, so run only a few at once.

Before removing a worktree, run `scripts/worktree-teardown.sh` in it to delete its containers and
volumes, then `git worktree remove`. Migrations stay sequentially numbered: when two branches add
the same number, the one merged second is rebased and renumbered.

[`scripts/cloud-setup.sh`](scripts/cloud-setup.sh) prepares a clean Linux machine, such as a Claude
Code cloud environment: it installs the pinned Node.js, pnpm, the dependencies and the Playwright
browser, and starts Postgres, Mailpit and RabbitMQ when Docker is available.

### Code Quality

```bash
pnpm lint:check    # Check code with oxlint
pnpm lint:fix      # Auto-fix oxlint issues
pnpm format:fix    # Format code with oxfmt
pnpm format:check  # Check formatting without writing
pnpm knip          # Finds and fixes unused dependencies, exports and files
```

## Project Structure

```
app/
├── core/domain/            # Pure domain logic: users and roles, allowed domains, slots and answers, time (see AGENTS.md)
├── adapters/               # Database access and session handling, called by loaders and actions
│   ├── appointments/       # Terminumfragen, participants, survey answers, calendar feed
│   ├── users/              # User and allowed-domain management
│   └── session/            # Better Auth session and access checks
├── routes/                 # Route modules (React Router) by feature, mapped to URLs in routes.ts
│   ├── welcome/            # Sign-in page
│   ├── overview/           # The judge's Terminumfragen, details, choosing the Termin
│   ├── draft/              # Drafting a Terminumfrage: data, time slots, participants, review
│   ├── survey/             # The guests' survey (/umfrage/:token)
│   ├── calendar/           # Calendar subscription page and iCalendar feed
│   ├── admin/              # User and domain management
│   ├── health/             # Readiness, database and SMTP checks
│   └── auth.ts             # Better Auth API handler
├── database/               # Kysely, connection pool, migrations (see "Database")
├── lib/
│   ├── infra/              # Env, secrets, logging, request context, access log, SMTP, RabbitMQ, body limit
│   │   └── erv-versand/    # Client for the Basisdienst: ERV Versand (request-reply over RabbitMQ)
│   ├── web/                # Base path, URL paths, responses, page meta, useHydrated
│   ├── auth/               # Better Auth setup and the route guards (uses adapters)
│   ├── calendar/           # iCalendar files for mails and the calendar feed
│   ├── email/              # Mail templates and delivery
│   └── erv/                # ERV invitations: the PDF and sending through the Basisdienst: ERV Versand
├── components/             # Reusable UI components
│   └── shared/             # AppShell, Breadcrumb, FlowPage, ReviewPage, NextSteps, ...
│       └── kern/           # KERN wrappers: KernAlert, KernBadge, KernButton, KernIcon, KernLink, ...
├── app.css                 # KERN Native/font imports + global defaults
└── root.tsx                # Root layout
doc/adr/                    # Architecture decision records
```

Imports point one way. `core` imports no other layer. `adapters` use `core`, `database` and
`lib/infra`; the session adapter also uses `lib/auth`. `lib/calendar`, `lib/email` and `lib/erv`
never import `adapters`: they take the types they need from `core`, and loaders pass them what
the adapters read. Only `lib/auth` calls adapters.

Unit tests live next to their source as `*.test.ts(x)` (e.g. `components/shared/FlowPage.test.tsx`).
Shared test helpers live in `tests/` and are imported with `~tests/…`.

Each layer has one import style, enforced by oxlint:

- `adapters`, `core`, `database`, `lib`, `scripts` and `server.js`: relative imports with the `.ts` extension (`../database/database.ts`), never `~/`. Node loads this code directly and does not resolve `~/`. The exception is `lib/email`, which imports the mail logo with Vite's `?inline`, so it only runs inside the app bundle and Vitest.
- `routes`, `components` and the files in `app/` itself: `~/` for other folders (`~/lib/infra/env`), `./` for the same folder, no `../` and no `.ts` extension.

### Styling

Use documented `@kern-ux/native` component markup and native tokens. KERN-provided
utilities are permitted when their native stylesheet is loaded; Tailwind and
custom utility frameworks are not. Put application-specific rules in a
colocated, component-prefixed stylesheet imported by its owning component.
The application follows the system light/dark preference using KERN's native
theme tokens. Use the semantic tokens (`--kern-color-layout-*`, `--kern-color-feedback-*`,
`--kern-color-action-*`): palette colours such as `--kern-color-neutral-050` look the same in both
schemes, so text on them becomes unreadable in one of them. If the design needs a colour KERN has
no semantic token for, define one in `app/app.css` for both schemes, like `--app-color-layout-band`.

## Database

The app uses **PostgreSQL** with [Kysely](https://kysely.dev/) for type-safe SQL and migrations. Connection code lives in `app/database`. Users, sessions, appointments, participants and allowed domains are all stored there.

### Local database

```bash
docker compose up -d      # start Postgres 18 (waits until healthy with --wait)
docker compose ps         # check status
docker compose down       # stop
docker compose down -v    # stop and delete the data volume (same as pnpm docker:reset)
```

Postgres is published on host port **5433**, so it can run next to other projects' databases on 5432.

### Base path

The app is served under `/verhandlungstermin-finder`, locally and in every environment, for
example `http://localhost:3000/verhandlungstermin-finder/`. The prefix is the constant
`BASE_PATH` in `app/lib/web/base-path.ts`; routing, asset URLs, cookies and emailed links all derive
from it, so changing it is a code change. Requests for `/` are redirected to the app, any other
path outside the prefix is a 404. The session cookie is named `jts.session_token` and scoped to
the prefix.

### Configuration

[`.env.defaults`](.env.defaults) holds the local connection settings and matches `docker-compose.yml`. `pnpm dev`, `pnpm start` and `pnpm db:migrate` load it, plus an optional, git-ignored `.env.local` for overrides. A git-ignored `.env` is loaded last; `scripts/worktree-setup.sh` writes it (see "Parallel work with git worktrees").

| Variable                             | Purpose                                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `DATABASE_HOST`, `DATABASE_PORT`     | Server address                                                                              |
| `DATABASE_NAME`                      | Database name                                                                               |
| `DATABASE_USER`, `DATABASE_PASSWORD` | Credentials, injected locally (see below for deployed)                                      |
| `DATABASE_SSL_MODE`                  | `verify-full` enables TLS, anything else disables it                                        |
| `SMTP_HOST`, `SMTP_PORT`             | Mail server address                                                                         |
| `SMTP_USER`, `SMTP_PASSWORD`         | Mail credentials, injected locally (see below for deployed)                                 |
| `SMTP_REQUIRE_TLS`                   | `false` skips the STARTTLS requirement (local mock)                                         |
| `RABBITMQ_HOST`, `RABBITMQ_PORT`     | Message broker address                                                                      |
| `RABBITMQ_VHOST`                     | Virtual host on the broker                                                                  |
| `RABBITMQ_USER`, `RABBITMQ_PASSWORD` | Broker credentials, injected locally (see below for deployed)                               |
| `RABBITMQ_TLS`                       | `false` connects without TLS (local broker), otherwise AMQPS                                |
| `SECRETS_FILE_PATH`                  | If set, credentials are read from files instead of env                                      |
| `BASE_URL`                           | Canonical public origin without a trailing slash (local default: `http://localhost:3000`)   |
| `BETTER_AUTH_SECRET`                 | Public local-only dummy by default; deployed signing secret mounted from the secret manager |
| `LOG_LEVEL`                          | `debug`, `info` (default), `warn`, `error`, `fatal` or `silent`                             |

In deployed environments the credentials are mounted from the secrets manager as `$SECRETS_FILE_PATH/database/jts_user` and `jts_password`, and the host, port and name come from the ConfigMap generated by the infra repo's Terraform. The SMTP credentials are mounted the same way as `$SECRETS_FILE_PATH/smtp/SMTP_USER` and `SMTP_PASSWORD`, while `SMTP_HOST` and `SMTP_PORT` come from a ConfigMap in the staging overlay. RabbitMQ follows the same pattern: `$SECRETS_FILE_PATH/rabbitmq/RABBITMQ_USER` and `RABBITMQ_PASSWORD` from the secret `rabbitmq` (properties `username` and `password`), and `RABBITMQ_HOST`, `RABBITMQ_PORT` and `RABBITMQ_VHOST` from the `rabbitmq-config` ConfigMap in each overlay of the infra repo.

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

Migrations `0003` to `0014` add the appointment, time slot and participant tables, the confirmed
window, survey tokens, allowed domains, the calendar sequence and token, participant e-mail
addresses, the minimum duration of an appointment, the availability windows of a response,
participant SAFE-IDs, and the invitations sent to participants.
Read the files for the details.

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

The migration files and `server.js` are run directly by Node's TypeScript support, so stick to erasable syntax (no enums or parameter properties) and follow the import style for their layer (see "Project Structure").

### Verifying the connection

`GET /verhandlungstermin-finder/health/database` runs `select now()` and returns `{"status":"ok","databaseTime":"..."}`, or `503` with `{"status":"error"}` if the query fails (details are only logged). It is deliberately separate from `GET /health`, which is the readiness probe and does not touch the database.

```bash
curl localhost:3000/verhandlungstermin-finder/health/database
```

`GET /verhandlungstermin-finder/health/smtp` connects to the SMTP server and authenticates (`verify()`), without sending any mail. It returns `{"status":"ok"}` or `503` with `{"status":"error"}`, and logs the details. Locally it checks the SMTP mock below.

`GET /verhandlungstermin-finder/health/rabbitmq` opens a connection to the RabbitMQ broker, which includes the login, and closes it again. It returns `{"status":"ok"}` or `503` with `{"status":"error"}`, and logs the details. Locally it checks the broker below.

### Local SMTP mock

`docker compose up -d` also starts [Mailpit](https://mailpit.axllent.org/), a catch-all SMTP server that keeps every mail it receives inside the container and never relays anything. `.env.defaults` points the app at it (`localhost:2525`, any credentials, no STARTTLS), so nothing you send locally leaves your machine.

- Web UI to read the received mails: http://localhost:8025
- REST API, e.g. `curl localhost:8025/api/v1/messages`
- Mails are lost when the container is removed (`docker compose down`)

To use a real server instead, override the non-secret `SMTP_HOST`, `SMTP_PORT`
and `SMTP_REQUIRE_TLS` settings in `.env.local`. Inject `SMTP_USER` and
`SMTP_PASSWORD` from 1Password, using the same CLI pattern as the auth secret below.

### Local RabbitMQ

`docker compose up -d` also starts a [RabbitMQ](https://www.rabbitmq.com/) broker with the management plugin. `.env.defaults` points the app at it (`localhost:5673`, vhost `/`, user `jts` / password `jts`, no TLS). It has no volume, so queues and messages are lost when the container is removed.

- Management UI: http://localhost:15673 (log in as `jts` / `jts`)
- Check the connection: `curl localhost:3000/verhandlungstermin-finder/health/rabbitmq`

To use a real broker instead, override the non-secret `RABBITMQ_HOST`, `RABBITMQ_PORT`,
`RABBITMQ_VHOST` and `RABBITMQ_TLS` settings in `.env.local`. Inject `RABBITMQ_USER` and
`RABBITMQ_PASSWORD` from 1Password, using the same CLI pattern as the auth secret below.

### Local ERV Versand

Invitations by ERV go through the Basisdienst: ERV Versand, a request-reply service on RabbitMQ
(see [`app/lib/infra/erv-versand`](app/lib/infra/erv-versand/README.md)). Locally, the Compose
service `erv-versand` stands in for it: [`tests/mock-services/fake-erv-versand.ts`](tests/mock-services/fake-erv-versand.ts)
sets up the `requests` exchange and the `replies.jts` queue and answers every request without
sending anything. It runs the repository's code and `node_modules`, so run `pnpm install` before
`docker compose up`. Its answer depends on the SAFE-ID:

| SAFE-ID                                                                | Answer           |
| ---------------------------------------------------------------------- | ---------------- |
| not a SAFE-ID, e.g. `DE.Example.1`                                     | Payload Invalid  |
| all-zero UUID: `DE.Example.00000000-0000-0000-0000-000000000000.0000`  | Receiver Unknown |
| any other, e.g. `DE.Example.00000000-0000-4000-8000-000000000001.0001` | sent             |

It also answers Payload Invalid when the XJustiz message or an attachment's name or content is
missing, but it does not look into the XJustiz message. See its log with
`docker compose logs erv-versand`.

Like Mailpit for e-mail, it keeps what the app sent (the last 200 requests, in memory) and shows it
through an HTTP API on port **8045**. The E2E tests read the sent invitation from it.

- `GET http://localhost:8045/messages?receiver=<SAFE-ID>`: the requests, newest first, with the
  decoded XJustiz message and the attachments in Base64. Without `receiver`, all of them.
- `GET http://localhost:8045/messages/<correlation ID>/attachments/Nachrichtentext.pdf`: the
  invitation PDF, to open in a browser.
- `DELETE http://localhost:8045/messages?receiver=<SAFE-ID>`: forgets the requests.
- `GET http://localhost:8045/health`: answers 200 once it consumes requests.

The invitation is an XJustiz 3.6.2 message `nachricht.gds.uebermittlungSchriftgutobjekte.0005005`
after the example of the Basisdienst team: sender and recipient in free text, the Aktenzeichen in the
short title, and the invitation PDF (which holds the personal survey link) as its only document,
named `Nachrichtentext.pdf` as the beA expects
([`app/lib/erv/erv-invitation-message.ts`](app/lib/erv/erv-invitation-message.ts)). Unit tests
validate it against the official XSDs in [`tests/xjustiz`](tests/xjustiz/README.md).

The judge does not wait for the ERV. "Per ERV" records the invitation as pending with a new
correlation ID, hands it to the broker and shows the guest list again ("Per ERV: wird gesendet").
Every app instance keeps one connection to the broker, opened when the server starts, and consumes
the replies. Whichever instance receives a reply marks the invitation as sent ("Per ERV
eingeladen") or not delivered ("Per ERV: nicht zugestellt"), with the problem type in
`participant_invitation.failure`. An invitation without a reply after 5 minutes shows as not
delivered; a reply that still comes settles it. If the broker cannot be reached, the invitation is
marked as not delivered at once and the page says so. The page does not update by itself: reload it
to see the reply.

## Authentication

Better Auth stores users, sessions, accounts, and hashed magic-link tokens
in PostgreSQL. The existing SMTP transport sends the links. The public
`/api/auth/*` endpoint and the login form both only serve provisioned users and
addresses on an allowed domain (see below). The login form tells other addresses
that they are not allowed; the API answers every address the same way and sends
no email. Links expire after
5 minutes and can only be used once; sessions last 24 hours.
IP-based rate limiting is explicitly disabled. Better Auth 1.7.10's magic-link
plugin has no built-in per-email resend cooldown; email throttling is not
currently implemented.

### Configuration

Set `BASE_URL` to the application's public origin in each environment, including
`http://` or `https://` and without a trailing slash. Do not include the base path.
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

### Allowed domains

Anyone with an address on an allowed domain can sign up themselves: the account is
created with the `richter` role when they open their first magic link, so only
owners of the address get an account. Domains are exact matches (subdomains need
their own entry), stored in the `allowed_domain` table. Removing a domain keeps
existing accounts and invalidates links that were not opened yet.

Administrators manage the list at `/admin/domains`. To bootstrap the first domain
without an administrator, run:

```bash
pnpm domain:add --domain example.com
```

In the deployed container, run `node scripts/add-domain.ts --domain example.com`.
The command runs migrations and fails if the domain is already allowed.

### Provision the first administrator

There are no default accounts. After starting the local database:

```bash
pnpm user:create-admin --email admin@example.com --name "Administrator"
```

The command runs migrations and creates an administrator; it fails if the
address already exists. It assigns only `admin` and accepts no role options.
Another administrator can change the user's roles in the admin UI, including
removing `admin`; users cannot remove their own administrator access.
In the deployed container, run the equivalent command using its mounted
database credentials:

```bash
node scripts/create-admin.ts --email admin@example.com --name "Administrator"
```

Request a link on the welcome page (`/`), then open the email in
[Mailpit](http://localhost:8025) locally. The account menu links administrators
to `/admin/users`, where they can add users, change names/roles/admin rights,
and delete users. Updating a user revokes their sessions. Deleting one removes
their sessions and outstanding magic links. Email addresses are immutable:
delete and re-create a user to change their address.

Administrators cannot delete their own account or remove their own admin rights.
Each user has a nonempty list containing any combination of `admin`, `richter`,
`klaeger`, and `beklagter`. After signing in, the home page is the overview of the user's
Terminumfragen. Only `richter` (and `admin`) can create and manage them; no page uses `klaeger`
or `beklagter` yet. The `admin` role grants access to every page as well as user management.
All loaders and actions enforce access server-side. The former role-picker
login and development-secret cookie are no longer accepted.

## Calendar Subscription

Every user has a private calendar feed with their open and confirmed Terminumfragen. The page
`/kalender-abonnieren` (signed in) shows the address and a `webcal:` link. The address looks like

```text
http://localhost:3000/verhandlungstermin-finder/api/calendars/<token>/feed.ics
```

Calendar apps cannot sign in, so the token in the address is the only credential. Each user has
one random token (`user.calendar_token`, created with the user). An unknown or malformed token
answers `404`. Never log the token or share the address. There is no way yet to reset the link;
revoking a leaked address means changing the token in the database.

Responses use `Content-Type: text/calendar; charset=utf-8; method=PUBLISH` and
`Cache-Control: no-store`. Drafts and cancelled appointments are not part of the feed.
`appointment.calendar_sequence` is raised for every calendar file sent by e-mail; the feed reads
it without raising it. Calendar apps replace an event only when its `SEQUENCE` is higher than
the copy they hold.

## Logging

The app writes one JSON object per line to stdout with [pino](https://getpino.io). In Kubernetes the platform's Loki collects it; the app does not ship logs itself. `pnpm dev` prints the same lines readably with `pino-pretty`.

```json
{
  "level": "info",
  "time": "2026-11-26T20:10:18.942Z",
  "requestId": "7c0e5a4e-…",
  "method": "GET",
  "route": "/verhandlungstermin-finder/umfrage/:token/zeitfenster",
  "status": 404,
  "responseTimeMs": 12,
  "msg": "request completed"
}
```

- **Fields:** `level` (as a name), `time` (ISO-8601) and `msg` on every line. Ids are separate fields in camelCase (`appointmentId`, `participantId`, `userId`, `correlationId`), never part of `msg`.
- **Request id:** every request gets the ingress's `X-Request-Id`, or a new UUID, and sends it back in the same header. Every line logged while a request is handled carries it as `requestId`, so `{app="…"} | json | requestId="…"` shows everything that happened in one request.
- **Access log:** [pino-http](https://github.com/pinojs/pino-http) writes one line per request in production (`requestId`, `method`, `route`, `status`, `responseTimeMs`, `contentLength`). `route` is the matched React Router pattern (`/umfrage/:token`), never the path, so tokens, ids and query strings stay out; it is `null` for paths without a route. Successful health checks are left out.
- **Audit trail:** actions of users, administrators and the system are logged with `logAudit()` and carry `audit: true`, an `event` (`appointment.confirmed`, `user.deleted`, …) and an `actorId` (a user or participant id, `system` or `cli`). Query them with `| json | audit="true"`.
- **Errors:** loaders, actions and rendering report errors through `handleError` in `app/entry.server.tsx`. Uncaught exceptions and unhandled rejections are logged as `fatal`, then the process exits and Kubernetes restarts the pod.
- **No personal data:** logs hold opaque ids only, never e-mail addresses, names, SAFE-IDs, tokens, links, cookies or IP addresses. As a safety net, `logging.ts` redacts known keys (`email`, `token`, `safeId`, …), logs only the type, message, code, stack and cause of errors, and replaces e-mail addresses in them.

Use `log` and `logAudit` from `app/lib/infra/logging.ts`; oxlint rejects `console`.

## Business Rules

- Data is stored in PostgreSQL.
- Only a `richter` (or `admin`) creates and manages Terminumfragen and confirms the final slot.
- Participants answer without signing in, through a survey link. A personal link answers once;
  the universal link of an appointment starts a new participant every time.
- Every Terminumfrage has a minimum duration in minutes. No proposed time slot may be shorter.
- A participant answers each slot with the times they are available in it: all of it, none of
  it, or one or more smaller windows. A window is at least the minimum duration long. Windows of
  one slot that overlap or touch are merged, in the survey and in the database.
- What is left of a slot is the time at which every participant who answered is available, in
  stretches of at least the minimum duration. Later participants are only offered what is left,
  and can only answer within it.
- Once nothing is left of any slot, the Terminumfrage is cancelled. It makes no difference
  whether a participant ruled a slot out or the participants have no time in common.
- The `richter` explicitly confirms the final appointment: a start time within what is left of
  one slot. The appointment runs until that remaining window ends and is at least the minimum
  duration long.
- What is left of a slot is never stored. It is worked out from the answers by
  `remainingWindows()` in `app/core/domain/availability.ts`, read through
  `app/adapters/appointments/availability.server.ts`. Answers and the confirmation are checked
  against it under a lock on the appointment row.
- Whether an answer is taken, what it leaves of the slots and whether the Terminumfrage is
  cancelled is decided by `stateAfterAnswer()` in `app/core/domain/survey.ts`, without a database.
  `app/adapters/appointments/survey.server.ts` only reads and writes the rows.

### Glossary

| Term                | German                  | Meaning                                                                                 |
| ------------------- | ----------------------- | --------------------------------------------------------------------------------------- |
| slot                | Zeitfenster             | A time range the `richter` proposed.                                                    |
| availability window | (kleineres) Zeitfenster | A time range a participant is available in. It lies within a slot and may be all of it. |
| remaining window    | –                       | What is left of a slot once every answer is taken into account.                         |
| confirmed window    | Termin                  | The final appointment. It lies within a remaining window.                               |

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
- One import style per layer (see "Project Structure")
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
