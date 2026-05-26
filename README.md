# Gerichtsterminplanung (Prototype)

In-memory scheduling prototype for legal appointments with three roles:

- `Richter`: creates and edits time slots, confirms the final appointment, can unlock party re-submission
- `Klaeger`: accepts/rejects each proposed slot
- `Beklagter`: accepts/rejects each proposed slot

Login requires no password — select a role from the dropdown.

## Confirmed Business Rules

- The prototype stores data in memory only.
- `Klaeger` and `Beklagter` share identical permissions.
- Parties submit once by default; after submission a party is locked until `Richter` unlocks them.
- `Richter` explicitly confirms one mutually accepted slot as the final appointment.

## Project Structure

```
app/
  core/
    domain/       entities and business types
    ports/        repository and service interfaces
    services/     SchedulingService, SchedulingQuery
  adapters/
    inMemory/     in-memory store and auth service
    session/      React Router cookie session
  routes/         UI adapters (React Router route modules)
  components/     shared UI components
  bootstrap.ts    composition root
```

## Run

```bash
pnpm install
pnpm dev
```

## Test

```bash
pnpm test
```

## Type Check

```bash
pnpm typecheck
```
