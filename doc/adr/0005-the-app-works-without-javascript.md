# 5. The app works without JavaScript

Date: 2026-11-05

## Status

Accepted

## Context

The application is a public-sector service. Its pages are rendered on the server by React Router, so most of them can work as plain forms and links.

Recorded retroactively on 2026-11-08. The date is when every Playwright spec was switched to run without JavaScript ([PR #92](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/92)). Before that, 7 of 77 E2E specs failed in that mode.

## Decision

Every page has to work with JavaScript switched off.

- Playwright runs **every** spec with `javaScriptEnabled: false` (`playwright.config.ts`). Do not turn JavaScript back on for a spec; fix the page instead.
- Anything that needs JavaScript, such as the copy buttons or opening all review sections at once, is an enhancement. It appears only after hydration, through `useHydrated`.
- A list of inputs cannot grow without JavaScript. Therefore every time slot, and every participant, is edited on a page of its own (`overview/:appointmentId/zeitfenster/:slotId`, `.../verfahrensbeteiligte/:participantId`). The earlier design kept the rows in client state and sent all slots in one request.

The reason is accessibility and robustness for a public-sector service. No standard or legal requirement is cited anywhere in the repository, so this is a project principle and not a decision taken to meet a named rule.

## Consequences

- The pages work for assistive technology, locked-down browsers and failed script loads.
- Some flows take more page loads than a single dynamic form would, because adding a slot or a participant is a round trip.
- Features that need client-side behaviour have to be designed as progressive enhancements. Reviewers should reject pages that only work after hydration.
- Because E2E runs without JavaScript, client-only behaviour is covered by unit and component tests, not by E2E.
