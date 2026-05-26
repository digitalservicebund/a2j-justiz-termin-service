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

- `src/domain/`: entities, domain rules, and the `SchedulingService`
- `src/application/`: read-side queries (`SchedulingQuery`)
- `src/infrastructure/`: in-memory store, auth service, session handling
- `src/bootstrap.ts`: composition root
- `app/routes/`: React Router route modules (UI adapters)
- `app/components/`: shared UI components

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
