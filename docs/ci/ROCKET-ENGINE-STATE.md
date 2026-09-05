# Rocket CI Engine — Phase 1 State

Status: IN_PROGRESS

Baseline: post-#506 `main`

## Implemented

- PR rescue path keeps required checks: `CI`, `Fast Contract Diagnostics`, `Canonical Verification Gate`.
- `Fast Contract Diagnostics` consumes the primary CI evidence artifact instead of reinstalling dependencies.
- Primary CI installs dependencies once.
- Impact-aware verification remains the execution authority for PR rescue mode.
- Playwright browser installation is sequenced before affected E2E.
- PR concurrency cancellation remains enabled.

## Verification Contract

A previous PASS is reusable only when its evidence belongs to the exact workflow SHA and the primary CI result is `PASS`.

## Next Engine Steps

1. Measure the new PR critical path.
2. Eliminate remaining duplicated installs/builds across PR workflows.
3. Add explicit dependency-aware `BLOCKED` semantics.
4. Add persisted checkpoints and safe result fingerprints.
5. Expand change-impact coverage without weakening required contracts.

## Guardrails

- Do not weaken required branch protection.
- Do not delete deep/manual certification workflows.
- Do not convert failures to success by allowlisting.
- Do not rerun unaffected work without an impact reason.
