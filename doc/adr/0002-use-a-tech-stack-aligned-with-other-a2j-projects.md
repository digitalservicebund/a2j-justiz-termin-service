# 2. Use a tech stack aligned with other A2J projects

Date: 2026-11-02

## Status

Accepted

## Context

Justiz Termin Service (JTS) is one of several Access to Justice (A2J) projects. A shared stack lets developers reuse knowledge, components, CI setup and review practices across projects.

## Decision

JTS uses the same frameworks as the other A2J projects:

- **TypeScript** for all application, server and script code.
- **React** for the user interface.
- **React Router** for routing and data loading. It runs behind an **Express** server.
- **Node.js** as the runtime.
- **Docker** to build the application as a container image, which is the artifact for deployment.
- **[KERN UX-Standard](https://www.kern-ux.de/)** as the design system.

It also uses the following tools, which can differ from the other A2J projects where this project needs it:

- **PostgreSQL** as the database, accessed through **Kysely** for type-safe queries and migrations.
- **pnpm** as the package manager.
- **Vite** as the build tool and dev server, through React Router.
- **Vitest** with Testing Library for unit and component tests, and **Playwright** for end-to-end tests.
- **oxlint** and **oxfmt** for linting and formatting, run through **lefthook** git hooks and in CI.
- **knip** to find unused files, exports and dependencies.

## Consequences

- Developers from other A2J projects can work on JTS without learning a new stack.
- Kysely table types are written by hand and must be kept in sync with the migrations.
