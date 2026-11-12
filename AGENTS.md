# Agent instructions

See [README.md](README.md) for the stack, project structure and styling rules.

## Before every commit and push

Run these from the repository root. All of them must pass; CI runs the same checks and fails the build otherwise.

```bash
lefthook run pre-commit --all-files   # format (oxfmt) and lint (oxlint)
pnpm typecheck
pnpm test                             # unit tests (Vitest)
```

- `lefthook run pre-commit --all-files` runs the pre-commit hook from `lefthook.yml` over the whole project, not only the staged files. It formats and auto-fixes lint problems, so it can change files: review those changes and stage them. It exits non-zero if lint errors remain.
- Typecheck and tests are listed separately because the pre-push hook only runs them on `main`. On any other branch `lefthook run pre-push` skips them, even with `--force`, so run them yourself.
- Fix failures before committing or pushing. Do not skip the checks or the git hooks (`--no-verify`).
- Check the real result of each command: its exit code and its summary line. Do not pipe the output through `grep`, `head` or `tail`, because that can hide a failed command, for example "Command not found".
- The package scripts are `lint:check` and `lint:fix`. There is no `pnpm lint`.

## End-to-end tests

CI also runs `pnpm test:e2e`. It needs Docker and starts its own isolated Compose project, so it does not touch the development database. Run it when you change routes or user-facing behaviour, and pass spec files to run only those:

```bash
pnpm test:e2e e2e/overview.spec.ts
```

## Working in parallel

Several agents can work at the same time, each in its own git worktree (`git worktree add`, or the Agent tool's `isolation: "worktree"`).

- Right after creating a worktree, run `scripts/worktree-setup.sh`. It gives the worktree its own ports, Docker Compose project and database through a git-ignored `.env`. See "Parallel work with git worktrees" in the README.
- Never run `docker compose down`, `pnpm docker:reset` or `docker compose` with another project name from a worktree. Use plain `docker compose` and `pnpm` there, which act on that worktree's project.
- Work in your worktree only. Do not edit the main checkout or other worktrees.
- Migrations are numbered sequentially. Check the highest number on `main` before you add one, and renumber when a rebase brings in the same number.
- Remove a finished worktree with `scripts/worktree-teardown.sh`, then `git worktree remove`.
- In a Claude Code cloud environment, `scripts/cloud-setup.sh` is the setup script. Without Docker there, `pnpm test:e2e` and `pnpm dev` do not work; leave E2E to CI and say so in the PR.

## Tests

- Unit and component tests live next to the code in `__test__/` folders. E2E specs live in `e2e/`.
- Add or update tests for every behaviour change, including the failure cases.

## Test and placeholder data

Never use data that looks real in tests, seed data, fixtures, stories or placeholder text.

- E-mail addresses must end in `example.com`, for example `person.a@example.com`.
- Personal information such as names must be obviously fake: `Person A`, `Judge B`, `Guest C`. Do not use realistic names.
- Courts are named `Court X`, `Court Y`, `Court Z` and so on, not real court names.

## Dates and times

All date and time logic lives in `app/core/domain/time/`. Everything is Berlin time (`Europe/Berlin`).

- Show dates and times with the functions in `format.ts`. Do not create `Intl.DateTimeFormat` instances or write `"Europe/Berlin"` anywhere else.
- Ask "which day is this?" with `berlinDay()`, never with the UTC day. Shortly after midnight in Berlin the UTC day is still the day before.
- Convert between form input and instants with `berlin.server.ts` (Temporal, server only). It rejects times that the clock change skips or repeats; do not pick one silently.
- Read database rows with `rowToRange()` and `confirmedWindow()` instead of calling `new Date(...)` on columns.
- Pure functions take `now` as an argument. Only loaders, actions and adapters call `new Date()`.

## Git hooks

`lefthook.yml` defines pre-commit and pre-push hooks, but they are not installed automatically. Run `lefthook install` once per clone. Running `lefthook run` also installs the git hooks into `.git/hooks` as a side effect.

## Implementing a Figma design

Use the Figma MCP server when asked to build or change a page from a Figma link. Its output is a reference to adapt, not code to paste.

1. **Check the node.** Confirm it shows the state the request describes. If it does not, ask for the right link before writing code.
2. **Read the design.** Create a session, then get the design context and a screenshot of the node. For large frames, request only the content frame: `AppShell` already provides header and footer.
3. **Translate to this project.** Figma returns React with Tailwind. Do not add Tailwind. Use KERN Native markup and tokens, reuse the shared components, and put page-specific rules in a colocated CSS file.
4. **Extend, don't duplicate.** If the design is another state of an existing page, extend that route and share the common parts.
5. **Test it.** Add unit tests and an E2E test, including the failure cases.
6. **Screenshot and compare.** Take a screenshot of the result at the design's width, using the design's sample values, and compare it with the Figma screenshot. Fix every deviation and repeat until they match. Do not commit the screenshots.
7. **Run the checks** from "Before every commit and push".
8. **Open a draft PR** from an up-to-date `main`. Put the Figma link of the implemented node in the description (`https://www.figma.com/design/<fileKey>/...?node-id=...`), also when you only changed a node. Mention anything that differs from the design on purpose or has no behaviour yet.
9. **Attach the screenshots.** The `gh` CLI can attach images directly (`gh pr create --attach`, `gh pr comment --attach`). This is the preferred way to put screenshots in a PR. Attach the Figma reference and the implementation.
