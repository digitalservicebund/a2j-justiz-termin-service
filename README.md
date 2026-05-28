# Gerichtsterminplanung (Prototype)

In-memory scheduling prototype for legal appointments with three roles:

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
- **Code Quality**: ESLint + Prettier
- **Testing**: Vitest

## Prerequisites

- Node.js 20+ (check with `node --version`)
- pnpm (install with `npm install -g pnpm` if needed)

## Installation

```bash
# Install dependencies
pnpm install

# Start development server with hot reload
pnpm dev
```

## Available Scripts

### Development

```bash
pnpm dev          # Start dev server with Vite + React Router
pnpm build        # Build for production (client + SSR)
pnpm start        # Serve production build
```

### Code Quality

```bash
pnpm lint         # Check code with ESLint
pnpm lint:fix     # Auto-fix ESLint issues
pnpm format       # Format code with Prettier
pnpm format:check # Check formatting
pnpm typecheck    # Type-check with TypeScript
```

### Testing

```bash
pnpm test         # Run tests with Vitest
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

## Confirmed Business Rules

- Data stores in memory only (not persisted)
- `Kläger` and `Beklagter` have identical permissions
- Parties submit once by default; locked until `Richter` unlocks
- `Richter` explicitly confirms one mutually accepted slot as final
- Multiple mutually-accepted slots require `Richter` confirmation

## Code Style & Formatting

This project uses **Prettier** and **ESLint** with automatic fixes on save (IntelliJ + VSCode).

### Prettier

- Single quotes disabled
- Trailing commas on all
- Tailwind class sorting
- Import organization

### ESLint

- TypeScript strict mode
- React/JSX best practices
- A11y (accessibility) rules

**Run format + lint together:**

```bash
pnpm format && pnpm lint:fix
```

## Docker

Build and run with Docker:

```bash
docker build -t scheduling-app .
docker run -p 3000:3000 scheduling-app
```

