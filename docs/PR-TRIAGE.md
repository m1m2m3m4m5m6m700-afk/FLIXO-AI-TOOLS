# PR Triage — Phase 1.1

Baseline after PR-1 merge: `aa945a4960a40a82c0588aa439d3be62a09ef3b8`.

## Explicit cleanup list

The requested legacy PR numbers `#91, #102, #103, #104, #106, #110, #111, #112, #113, #115` are not present in the current open-PR inventory, so no close action is required for them at this point. This records the observed state rather than fabricating close operations.

## Rebuild candidates

| Legacy PR | New branch | Base | Rule |
| --- | --- | --- | --- |
| #126 SEO/CWV | `rebuild/seo-126-on-main` | `main` at `aa945a4` | Rebuild only the useful diff against current main. No stale-history merge. |
| #134 Governance | `rebuild/governance-134-on-main` | `main` at `aa945a4` | Rebuild only the useful governance delta against current main. |
| #219 Recharts v3 | `recharts-v3-test` | `main` at `aa945a4` | Isolated dependency experiment; no production promotion from the legacy branch. |

## Isolation policy

`recharts-v3-test` must prove `npm ci`, typecheck, lint, build, production audit, browser smoke, and bundle/dependency effects before any promotion decision.

The rebuild branches remain independent of `main`. They are not merged by this triage PR.

## Rollback

This PR changes documentation only. Rollback is the PR merge commit revert. The three experiment/rebuild branches can be deleted later only after their evidence has been preserved and a separate decision is recorded.
