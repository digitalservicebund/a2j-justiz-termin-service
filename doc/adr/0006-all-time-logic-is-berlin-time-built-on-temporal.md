# 6. All time logic is Berlin time, built on Temporal

Date: 2026-11-02

## Status

Accepted

## Context

Hearings are scheduled in German local time. Before this decision the code had about six `Intl.DateTimeFormat` instances, a "fake UTC date" trick, roughly six copies of the row-to-range mapping, three copies of the confirmed-window rule and hand-rolled daylight-saving code. Asking "which day is this?" with the UTC day gives the wrong answer shortly after midnight in Berlin.

Recorded retroactively on 2026-11-08. The date is when the time module was introduced ([PR #74](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/74)).

## Decision

All date and time logic lives in `app/core/domain/time/`, and everything is `Europe/Berlin`.

- Dates and times are shown with the functions in `format.ts`. Nothing else creates an `Intl.DateTimeFormat` or writes `"Europe/Berlin"`.
- "Which day is this?" is answered by `berlinDay()`, never by the UTC day.
- Form input and instants are converted in `berlin.server.ts`, which uses Temporal and is server-only. It **rejects** local times that the clock change skips or repeats (for example 02:30 on 2027-03-28 and on 2026-10-25) and never picks one silently.
- Database rows are read with `rowToRange()` and `confirmedWindow()`, not with `new Date(...)` on the columns.
- Pure functions receive `now` as an argument. Only loaders, actions and adapters call `new Date()`.
- `wall-clock.ts` checks a time with `Intl` so the form can validate in the browser as well. A test checks that it agrees with Temporal on every minute of six days, including the four clock-change days.

The decision was taken because of the daylight-saving bugs and the duplicated code. The sources do not record a comparison with other date libraries.

## Consequences

- There is one place to look for, and to test, the clock-change rules.
- A judge who enters a time that does not exist, or exists twice, gets an error and has to choose.
- Temporal is used through the TypeScript Temporal types (commit 77a91df replaced a local declaration).
- Code outside `app/core/domain/time/` that formats dates or compares days by hand is a defect and should be moved into the module.
- Migration `0009` adds a database check that a confirmed appointment has its window, which keeps stored data in line with the same rules.
