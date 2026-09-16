# WP0 Execution Record — 2026-09-16

## Scope

Start execution of `مهام.md` at **WP0 — TRUST BASELINE + AGENT CORE**.

## Current evidence

- Production branch: `main`.
- Canonical verification contract: `npm run verify`.
- The repository already contains explicit agent task-state and execution-gate contracts and regression scripts.
- CI architecture already declares canonical verification/build/evidence ownership and root-cause diagnostics.
- Target incident for this execution cycle: GitHub Actions run `35037318071`.

## Execution policy

1. Do not mark WP0 complete from documentation alone.
2. Every change must be tied to a reproducible check or CI evidence.
3. Preserve the existing fail-closed execution/confirmation semantics.
4. Keep the exact failing CI root cause recorded before declaring the incident fixed.
5. Re-run the canonical verification surface after each repair.

## Initial WP0 acceptance gates

- [ ] Exact failing job and first actionable error extracted from run `35037318071`.
- [ ] Root cause reproduced or otherwise proven from repository/CI evidence.
- [ ] Minimal corrective change committed.
- [ ] Agent state/execution-gate regression tests green.
- [ ] `npm run verify` green for the resulting candidate.
- [ ] CI run on the candidate SHA green for required jobs.
- [ ] Change log updated with commit SHA and evidence.

## Status

**IN PROGRESS — NOT CERTIFIED.**

This record intentionally does not claim the target run is fixed until fresh CI evidence proves it.
