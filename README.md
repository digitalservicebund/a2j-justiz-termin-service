# Gerichtsterminplanung (Prototype)

In-memory scheduling prototype for legal appointments with three roles:

- `Richter`: creates and edits time slots, can unlock party re-submission
- `Klaeger`: accepts/rejects each proposed slot
- `Beklagter`: accepts/rejects each proposed slot

## Confirmed Business Rules

- The prototype stores data in memory only.
- `Klaeger` and `Beklagter` share identical permissions.
- Parties submit once by default.
- After submission, a party is locked until `Richter` unlocks them.
- The final appointment is the first slot accepted by both parties.

## Hexagonal Architecture

- `app/core/domain`: entities and domain rules
- `app/core/application`: use cases (`SchedulingService`)
- `app/core/ports`: repository and id generator contracts
- `app/adapters/in-memory`: in-memory persistence and composition root
- `app/routes`: UI adapters (React Router route modules)

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
