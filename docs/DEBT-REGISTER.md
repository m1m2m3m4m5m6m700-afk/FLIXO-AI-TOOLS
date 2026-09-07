# FLIXO Debt Register

## Current repair baseline — 2026-09-07

- Production source of truth: `main` (`fdf549ec7ab184c2485b081e4c9e9d9a60e43b29` at the start of this repair session).
- Active repair branch: `repair/2026-09-07-session-001`.
- This register records only currently actionable engineering debt. Historical snapshots belong in evidence artifacts, not in the active queue.

## Priority model

- **P0** — blocks trustworthy architecture, release truth, or safe change propagation.
- **P1** — materially increases complexity, duplication, maintenance risk, or release cost.
- **P2** — cleanup that improves coherence after P0/P1 work.

## Active debt

| ID | Area | Priority | Action | Exit criterion | Status |
| --- | --- | --- | --- | --- | --- |
| D-002 | Release evidence observability | P0 | Keep CODE / DEPLOYMENT / MISSING-EVIDENCE states explicit and tied to exact-SHA evidence. | Every promotion decision has fresh exact-SHA evidence. | Open |
| D-003 | Verification surface | P1 | Consolidate overlapping `validate:*`, `report:*`, `test:*`, `check`, and `verify` ownership without weakening coverage. | One canonical owner and entry point per contract domain. | Open |
| D-004 | Tool contract cohesion | P0 | Continue deriving registry consumers from one canonical tool definition model; route collision detection is now shared between registry and manifest. | A new tool is represented once across registry/manifest/router/SEO/sitemap/i18n/E2E. | **Partially resolved** |
| D-005 | Canonical origin | P1 | Keep production origin resolution centralized and fail-closed; eliminate deployment-origin duplication where safe. | Canonical SEO generation has one validated production-origin authority. | Open |
| D-006 | Heavy dependency governance | P1 | Inventory and classify heavy/optional media, PDF, database, and mail dependencies; remove demonstrably unused packages. | No unused heavy dependency remains in the runtime graph. | Open |
| D-007 | i18n ownership fragmentation | P1 | Converge historical localized data surfaces onto canonical locale configuration/types/loaders. | One clear owner per translation concern with no shadow locale source. | Open |
| D-008 | Artifact contract cohesion | P1 | Standardize MIME/signature/binary/download assertions behind reusable output contracts. | Every file-producing tool declares and proves its artifact contract. | Open |
| D-009 | Shared browser harness | P1 | Extract reusable lifecycle/input/output/error/a11y checks from matrix/tool-specific duplication. | Common browser contract checks are reused rather than replicated. | Open |
| D-010 | Branch hygiene | P2 | Triage historical branches only after verifying they contain no unique active work or evidence. | Active branch set is small and intentional. | Open |
| D-011 | Issue hygiene | P2 | Triage obsolete issues and preserve only actionable roadmap work. | Every open issue has a current purpose and next action. | Open |
| D-012 | Release artifacts | P2 | Create immutable release artifacts only after full certification. | Tag/release and exact-SHA evidence are linked. | Planned |

## Resolved in this repair cycle

- **D-001 Current-state documentation:** obsolete August baseline data was removed from the active register and replaced with the current repair-session baseline.
- **Obsolete documentation files:** `docs/FOUNDATION.md` and `docs/PHASE-1-NEXT.md` were removed after confirming they were stale, unreferenced, and inconsistent with the current repository state.
- **F-006 / RC-I18N-TYPE-001:** `Locale` tightened to `CanonicalLocale`; locale metadata and translation bundles now use the canonical union.
- **RC-REGISTRY-LAYERS-001:** registry and manifest now share `createToolPathIndex()` so canonical routes and aliases cannot silently overwrite one another.

## Rules

1. No direct development changes to `main`.
2. One coherent debt cluster per PR.
3. No unrelated dependency upgrades inside consolidation work.
4. Do not delete historical material solely for cleanliness; delete only when it is demonstrably stale, unreferenced, and misleading or valueless.
5. No release certification without fresh exact-SHA evidence.
6. A cleanup is complete only when its exit criterion is demonstrable by code or CI evidence.
7. A new duplicate source of truth is a regression and must be rejected.
