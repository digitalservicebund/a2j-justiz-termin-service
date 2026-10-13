# Justiz Termin Service (JTS)

**This application is currently a prototype/proof of concept and not meant for production.**

- **Richter** (judge): creates and edits time slots, confirms the final appointment, can unlock party re-submission
- **Kläger** (plaintiff): accepts/rejects each proposed time slot
- **Beklagter** (defendant): accepts/rejects each proposed time slot

Login requires no password — select a role from the dropdown.

## Tech Stack

- **Frontend**: React 19 + React Router 7 (SSR)
- **Styling**: Tailwind CSS 4 + KERN UX theme
- **Build**: Vite + esbuild
- **Language**: TypeScript 5.9
- **Package Manager**: pnpm
- **Code Quality**: oxlint + Prettier
- **Testing**: Vitest + Istanbul coverage

## Prerequisites

- Node.js 26+ (check with `node --version`)
- pnpm (install with `npm install -g pnpm` if needed)
- lefthook (install with `lefthook install`)

## Installation

```bash
pnpm install
pnpm dev
```

## Available Scripts

### Development

```bash
pnpm dev         # Start dev server with Vite + React Router
pnpm build       # Build for production (client + SSR)
pnpm start       # Serve production build
pnpm typecheck   # Type-check with TypeScript
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
pnpm format:fix    # Format code with Prettier
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
├── components/             # Reusable UI components
│   ├── shared/             # Alert, AppNav, Badge, Button, Card, InputRadios, PartyScreen, SchedulingShared
│   ├── RichterSections.tsx       # Judge dashboard sections
│   └── RichterProcessSection.tsx # Task list for judge workflow
├── hooks/                  # useRichterActions
├── app.css                 # Tailwind + custom styles
├── root.tsx                # Root layout
└── bootstrap.ts            # Dependency injection root
```

Tests live alongside their source in `__test__` subdirectories (e.g. `components/shared/__test__/`).

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
**13:00 to 14:00 Europe/Berlin**, starting on **13 October 2026**, without an end
date. Its timezone definition preserves Berlin local time across daylight-saving
changes. The event UID and timestamps remain fixed across requests.

Responses use `Content-Type: text/calendar; charset=utf-8` and
`Cache-Control: no-store`. Calendar applications choose their own refresh
schedule. Adding the URL as a subscription keeps it refreshable; downloading and
importing the file is a one-time copy.

This endpoint is mock-only: it has no subscriber storage, access control, real
appointments, attendees, location, description, or reminders.

## Confirmed Business Rules

- Data stores in memory only (not persisted)
- `Kläger` and `Beklagter` have identical permissions
- Parties submit once by default; locked until `Richter` unlocks
- `Richter` explicitly confirms one mutually accepted slot as final
- Multiple mutually-accepted slots require `Richter` confirmation

## Code Style & Formatting

This project uses **Prettier** and **oxlint** with automatic fixes on save (IntelliJ + VSCode).

### Prettier

- Single quotes disabled
- Trailing commas on all
- Tailwind class sorting
- Import organization

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

### Podman

```bash
podman build -t a2j-justiz-termin-service .
podman run -p 3000:3000 localhost/a2j-justiz-termin-service
```

On macOS, start the Podman machine first if it isn't running:

```bash
podman machine start
```
