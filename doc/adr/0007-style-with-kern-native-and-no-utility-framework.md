# 7. Style with KERN Native and no utility framework

Date: 2026-10-14

## Status

Accepted

## Context

ADR 2 chose the KERN UX-Standard as the design system. The first version used Tailwind with a KERN theme. Two styling systems would each define spacing, colour and layout, and could drift apart.

Recorded retroactively on 2026-11-08. The date is when Tailwind was removed ([PR #9](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/9)). The layout rules were tightened on 2026-11-06 in [PR #94](https://github.com/digitalservicebund/a2j-justiz-termin-service/pull/94).

## Decision

Style with `@kern-ux/native`, and nothing else for the basics.

- Use documented KERN component markup and native tokens. KERN-provided utilities are allowed when their native stylesheet is loaded. Tailwind and custom utility frameworks are not allowed.
- Application-specific rules go into a colocated, component-prefixed stylesheet that its owning component imports.
- Layout, spacing and alignment come from KERN's grid and helper classes. Pages pass props to the shared wrappers in `app/components/shared/kern/` and do not write flex or grid CSS or thread `className` through components. `classNames` is the one way to join class names and `kern-m-none` the one way to remove a margin.
- The layout CSS must not depend on stylesheet order. A layout E2E test checks the pages at 320, 768, 1280 and 1920 px.
- The application follows the system light or dark preference through KERN's native theme tokens.

The reason, as confirmed by the team, is one styling system that the design system owns. The pull request that removed Tailwind does not state a reason itself.

## Consequences

- Design updates from KERN arrive through the package and not through a copied theme.
- KERN's fonts and stylesheet are imported from the installed package in `app/app.css` and `app/root.tsx`. PR #9 mentioned a dependency on a CDN and the latest published version; the code no longer loads them from a CDN.
- Some designs need page-specific CSS where KERN has no helper. That CSS must stay in the colocated stylesheet.
- KERN's widths are measured against a design frame of 1440 px, so layouts at other widths are an approximation of the design, which the layout E2E test keeps in check.
