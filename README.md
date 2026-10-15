# Justiz Termin Service (JTS)

**This application is currently a prototype/proof of concept and not meant for production.**

- **Richter** (judge): creates and edits time slots, confirms the final appointment, can unlock party re-submission
- **Kläger** (plaintiff): accepts/rejects each proposed time slot
- **Beklagter** (defendant): accepts/rejects each proposed time slot

Login requires no password — select a role from the dropdown.

## Tech Stack

- **Frontend**: React 19 + React Router 7 (SSR)
- **Styling**: KERN UX Native + colocated component CSS
- **Build**: Vite + esbuild
- **Language**: TypeScript 5.9
- **Database**: PostgreSQL 18 + Kysely (query builder and migrations)
- **Package Manager**: pnpm
- **Code Quality**: oxlint + oxfmt
- **Testing**: Vitest + Istanbul coverage

## Prerequisites

- Node.js 26+ (check with `node --version`)
- pnpm (install with `npm install -g pnpm` if needed)
- Docker (or another container runtime with `docker compose`) for the local database
- lefthook (install with `lefthook install`)

## Installation

```bash
pnpm install
docker compose up -d   # local PostgreSQL, see "Database" below
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
pnpm test           # Run tests once
pnpm test:watch     # Run tests in watch mode
pnpm test:coverage  # Run tests with Istanbul coverage report
```

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
│   ├── inMemory/           # In-memory Store & Auth
│   └── session/            # React Router session
├── routes/                 # Route modules (React Router)
├── database/               # Kysely, connection pool, migrations (see "Database")
├── lib/                    # Env, secrets and logging helpers
├── components/             # Reusable UI components
│   ├── shared/             # Alert, AppNav, Badge, Button, Card, InputRadios, PartyScreen, SchedulingShared
│   ├── RichterSections.tsx       # Judge dashboard sections
│   └── RichterProcessSection.tsx # Task list for judge workflow
├── hooks/                  # useRichterActions
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

| Variable                             | Purpose                                                |
| ------------------------------------ | ------------------------------------------------------ |
| `DATABASE_HOST`, `DATABASE_PORT`     | Server address                                         |
| `DATABASE_NAME`                      | Database name                                          |
| `DATABASE_USER`, `DATABASE_PASSWORD` | Credentials, local only (see below for deployed)       |
| `DATABASE_SSL_MODE`                  | `verify-full` enables TLS, anything else disables it   |
| `SMTP_HOST`, `SMTP_PORT`             | Mail server address                                    |
| `SMTP_USER`, `SMTP_PASSWORD`         | Mail credentials, local only (see below for deployed)  |
| `SECRETS_FILE_PATH`                  | If set, credentials are read from files instead of env |

In deployed environments the credentials are mounted from the secrets manager as `$SECRETS_FILE_PATH/database/jts_user` and `jts_password`, and the host, port and name come from the ConfigMap generated by the infra repo's Terraform. The SMTP credentials are mounted the same way as `$SECRETS_FILE_PATH/smtp/SMTP_USER` and `SMTP_PASSWORD`, while `SMTP_HOST` and `SMTP_PORT` come from a ConfigMap in the staging overlay.

### Migrations

Migrations are Kysely migration files in `app/database/migrations`. They run automatically on startup (`pnpm dev`, `pnpm start` and the container), or manually with `pnpm db:migrate`. If the database is unreachable, the app does not start.

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

`GET /health/smtp` connects to the SMTP server and authenticates (`verify()`), without sending any mail. It returns `{"status":"ok"}` or `503` with `{"status":"error"}`, and logs the details. Locally the defaults point at `localhost:587` with dummy credentials, so it returns `503` unless you override `SMTP_*` in `.env.local`.

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
