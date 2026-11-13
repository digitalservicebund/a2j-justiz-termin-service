# 9. Write Kysely migrations by hand and keep the Better Auth schema vanilla

Date: 2026-10-14

## Status

Accepted

## Context

The application needs a database schema that Better Auth also uses (`user`, `session`, `account`, `verification`), plus application tables. Better Auth can generate and run its own migrations, and upgrades of Better Auth can change what it expects.

Recorded retroactively on 2026-11-08. The date is when the Kysely connection and migration runner were added ([PR #10](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/10)); the auth schema followed on 2026-10-16 ([PR #17](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/17)).

## Decision

Migrations are Kysely migration files in `app/database/migrations`, written by hand, with sortable numeric prefixes.

- They run on startup (`pnpm dev`, `pnpm start`, the container) and with `pnpm db:migrate`. If the database is unreachable, the app does not start.
- `0001-auth.ts` reproduces exactly the vanilla PostgreSQL schema that the Better Auth CLI generates (version 1.7.10). `0002-user-management.ts` only adds the application's `roles` text array. Better Auth's columns, defaults and constraints stay unchanged.
- Role names and e-mail normalisation are validated in the application, not constrained in the database.
- Shipped migrations are never edited. A Better Auth upgrade or a schema change gets a new migration. (The auth migration was rewritten once, before production use, with no compatibility migration. Developers recreated their local database.)
- Table types in `app/database/types.ts` are written by hand and kept in step with the migrations.
- When a constraint is added to existing data, the migration backfills first and adds the check afterwards (see `0009-confirmed-window-required.ts`).
- Migration files and `server.js` run directly in Node's TypeScript support, so they use erasable syntax only and `.ts` import extensions.
- Ids are text columns defaulting to `gen_random_uuid()::text`.

The reasons recorded by the team: the schema should be reviewable and stable in git, independent of what Better Auth's tooling would generate on an upgrade, and the set of roles can change faster than a database constraint is worth a migration. The sources do not record a comparison with other migration tools.

## Consequences

- A Better Auth upgrade needs a human to compare the generated schema with ours and write a migration.
- Types and migrations can drift. Nothing generates the types, so reviewers must check both.
- Invalid role values or addresses are stopped by the application, and the database does not catch a bug in that code.
- Migrations are numbered sequentially, so two branches that add the same number must renumber the one merged second.
