# FLIXO Phase 1 — Foundation

## Scope

Phase 1 stabilizes the product shell before new growth features are added.

- Responsive unified tool shell remains the shared route surface.
- RTL/LTR behavior remains locale-driven.
- Privacy status is explicit: local tools are labeled local; external AI tools are labeled external.
- PWA manifest and safe service-worker shell caching are available in production builds.
- Service-worker registration is progressive and never blocks application startup.

## Non-goals

Command palette, local history/favorites, tool chaining, SEO expansion, hybrid AI, browser extension, widgets, and monetization are deferred to later phases.

## Acceptance

CI must pass the repository's existing typecheck, lint, build, integrity, localization, SEO, and E2E gates for the resulting commit.
