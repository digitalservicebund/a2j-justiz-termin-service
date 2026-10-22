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
- Do not add new lint warnings. The existing `no-console` warnings in the calendar code are known.
- Check the real result of each command: its exit code and its summary line. Do not pipe the output through `grep`, `head` or `tail`, because that can hide a failed command, for example "Command not found".
- The package scripts are `lint:check` and `lint:fix`. There is no `pnpm lint`.

## End-to-end tests

CI also runs `pnpm test:e2e`. It needs Docker and starts its own isolated Compose project, so it does not touch the development database. Run it when you change routes or user-facing behaviour, and pass spec files to run only those:

```bash
pnpm test:e2e e2e/overview.spec.ts
```

## Tests

- Unit and component tests live next to the code in `__test__/` folders. E2E specs live in `e2e/`.
- Add or update tests for every behaviour change, including the failure cases.

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
8. **Open a draft PR** from an up-to-date `main`. Mention anything that differs from the design on purpose or has no behaviour yet.
9. **Attach the screenshots.** The `gh` CLI can attach images directly (`gh pr create --attach`, `gh pr comment --attach`). This is the preferred way to put screenshots in a PR. Attach the Figma reference and the implementation.
