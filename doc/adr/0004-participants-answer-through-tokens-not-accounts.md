# 4. Participants answer through tokens, not accounts

Date: 2026-10-23

## Status

Accepted

## Context

A judge asks the people of a proceeding (Kläger, Beklagter and other Verfahrensbeteiligte) which proposed time slots suit them. These people are not users of the application. Giving each of them an account would put sign-up, passwords or magic links, and role management between them and a single answer.

Recorded retroactively on 2026-11-08. The date is when the survey flow was merged ([PR #39](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/39)); the tables were added a few days earlier in migration `0003`. Related: ADR 3 (sign-in), which covers judges and administrators only.

## Decision

Participants answer a Terminumfrage at `/umfrage/:token` without signing in. The token in the address is the credential.

There are two kinds of token:

- **Universal link:** one per appointment (`appointment.universal_token`), created when the appointment is published. Everyone who opens it starts a new participant by giving a name. Migration `0005` gave tokens to appointments that were published before the column was used.
- **Personal link:** one per listed person (`participant.token`, 24 random bytes, base64url). It already knows the name and can answer once.

Migration `0003` records why both exist: product had not decided between anonymous links and a personal link per participant, so both are implemented, to be simplified once that is settled. The judge lists people by e-mail address, with a name that is optional when there is an address (migration `0010`).

The token is meant to be the core of the design and the way it reaches a person is meant to be replaceable: e-mail, ERV (Elektronischer Rechtsverkehr) or manual handling by the court. **This is the intended design, not what the code does today:**

- Personal tokens are issued for every listed person, but nothing sends them. No code path delivers a link to a participant ([PR #93](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/93) and its E2E test check that no mail goes to them).
- The only delivery code, `deliverEmail`, mails the judge. It is tied to SMTP, `BASE_URL` and the judge's own link, so it is not a general delivery interface.

## Consequences

- Participants need nothing but the link. There is no account to create, forget or lose.
- Whoever holds a link can answer as that participant. A personal link is a secret and must not be shared more widely than its person.
- Delivery is a manual step today. The judge shares links outside the application.
- **Open point:** whether to keep both the universal and the personal link is undecided. Dropping one means removing columns and routes.
- **Open point:** adding delivery (e-mail, ERV, manual handling) needs a delivery interface that does not exist yet. That should be a new ADR when the first channel beyond the judge's e-mail is built.
