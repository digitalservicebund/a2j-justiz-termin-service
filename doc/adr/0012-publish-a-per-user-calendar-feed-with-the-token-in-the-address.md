# 12. Publish a per-user calendar feed with the token in the address

Date: 2026-10-30

## Status

Accepted

## Context

Judges want their Terminumfragen and confirmed appointments in their own calendar. Calendar applications subscribe to a URL and fetch it on a schedule. They cannot sign in to the application.

The first version was a mock feed that returned the same demo events for any calendar ID.

Recorded retroactively on 2026-11-08. The date is when the real feed replaced the mock ([PR #71](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/71)). The calendar `SEQUENCE` counter was added on 2026-10-28 ([PR #53](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/53)).

## Decision

Each user has a private feed at `/api/calendars/:token/feed.ics`, and the token in the address is the only credential.

- `user.calendar_token` is a random UUID, unique, and created with the user (migration `0008`). The address reveals nothing else about the user.
- An unknown or malformed token answers `404`. The token is never logged, and the access log leaves out query strings.
- The feed contains the user's open appointments with all their slots, and confirmed appointments with the chosen window. Drafts and cancelled appointments are left out. Event IDs are the same as in the e-mails (`timeslot-<id>`), so a calendar app treats mail and feed as one event.
- Calendar apps replace an event only when its `SEQUENCE` is higher than the copy they hold. `appointment.calendar_sequence` (migration `0007`) is raised atomically for every calendar file sent by e-mail, and the feed reads it without raising it.
- There is no `ATTENDEE`, so the feed produces no replies. The organiser is the sender address of the mail server because Outlook needs one.
- Responses are `text/calendar; method=PUBLISH` with `Cache-Control: no-store`.
- Signed-in users find their address and a `webcal:` link at `/kalender-abonnieren`.

The token is in the address because calendar applications cannot sign in. The sources do not record a comparison with other ways to protect the feed.

## Consequences

- Anyone who has the address can read the user's appointments. The address has to be treated as a secret.
- **Known limitation:** there is no "reset link". A leaked address can only be revoked by changing the token in the database ([PR #71](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/71) says the same).
- The feed does not push changes. How soon a calendar shows an update depends on how often the calendar app polls.
- Adding a participant calendar later would need a separate decision, because participants have no accounts (see ADR 4).
