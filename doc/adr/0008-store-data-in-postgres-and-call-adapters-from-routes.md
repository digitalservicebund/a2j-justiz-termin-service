# 8. Store data in Postgres and call adapters from routes

Date: 2026-10-22

## Status

Accepted

## Context

The first version was a prototype. It kept scheduling data in an in-memory store behind a ports and services layer (`SchedulingService`, `SchedulingQuery`, `VerfahrenRepository`, `InMemoryStore`) and had separate routes for judge, plaintiff and defendant.

Recorded retroactively on 2026-11-08. The decision happened over several days: the Postgres connection arrived on 2026-10-15 ([PR #10](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/10)), the schema on 2026-10-21 ([PR #20](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/20)), and the old code was removed on 2026-10-22 (PRs #29 and #36). The date is the removal.

## Decision

Appointments, time slots, participants, users and allowed domains are stored in PostgreSQL, accessed with Kysely.

Loaders and actions call adapters in `app/adapters/` directly. An adapter takes the Kysely database as an argument and returns plain data. There is no separate ports layer between routes and the database. `app/core/domain/` holds only pure logic, such as users and roles, allowed domains and time.

The earlier layer was removed as unused code once nothing called it. The rule going forward is: **no port or service interface until there is a second implementation that needs one.**

## Consequences

- Fewer layers to read and fewer files to change per feature.
- The domain is no longer independent of the database in the way a hexagonal layout would make it. Swapping the database, or adding a second delivery channel, means introducing the interface at that point.
- `knip` finds unused code, so abandoned layers do not stay in the repository unnoticed.
