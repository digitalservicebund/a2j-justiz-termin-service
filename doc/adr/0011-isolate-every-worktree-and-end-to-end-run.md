# 11. Isolate every worktree and end-to-end run

Date: 2026-10-16

## Status

Accepted

## Context

Several developers and several coding agents work on the project at the same time, on one machine. If they share a database, a mail catcher or ports, they interfere with each other: tests see each other's data and servers cannot start because a port is taken. End-to-end tests also must not touch the development database.

Recorded retroactively on 2026-11-08. The date is when isolated E2E runs were introduced ([PR #18](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/18)). Per-worktree environments followed on 2026-11-02 ([PR #77](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/77)).

## Decision

Each running copy of the project gets its own services.

- **E2E:** `pnpm test:e2e` starts its own Docker Compose project (`jts-e2e`) from the root `docker-compose.yml`, with its own ports and database volume, and removes everything afterwards, whether it succeeds or fails. It uses the settings in `.env.e2e`, public test-only values and never real secrets. Playwright runs with one worker.
- **Worktrees:** every git worktree is given a slot from 1 to 9 by `scripts/worktree-setup.sh`. The slot determines the ports and the Compose project, and a git-ignored `.env` carries it. The main checkout is slot 0 and keeps the default ports. E2E runs in a worktree shift their ports and project name by the same slot, so they do not collide either.
- `scripts/worktree-teardown.sh` removes a worktree's containers and volumes before `git worktree remove`.
- Never run `docker compose down`, `pnpm docker:reset` or a Compose command with another project name from a worktree.
- `scripts/cloud-setup.sh` prepares a clean Linux machine, such as a Claude Code cloud environment. Without Docker there, E2E is left to CI.

The alternative was coordinating ports and one shared database by hand. Full isolation costs a complete Docker stack for each worktree and each E2E run.

## Consequences

- Agents and people can work in parallel without sharing state.
- Every E2E run starts a full stack, so only a few should run at once. Nine worktree slots is a hard limit.
- Disk and memory use grow with the number of worktrees.
- The scripts and port tables are part of the project and must be kept up to date when services are added.
- Where Docker is not available, E2E tests cannot run locally and CI is the only check.
