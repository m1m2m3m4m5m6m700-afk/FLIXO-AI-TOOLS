# FLIXO Engineering Baseline

This is the single coordination contract for the repository. Existing diagnostic, repair, certification, SEO, and tooling components remain intact; this document defines how they connect.

## Branch roles

- `main`: only production baseline and release source.
- `develop`: integration branch for validated application changes.
- `experimental`: isolated diagnostics/repair laboratory. It may contain stronger experimental automation, but it is never a direct production source.
- `feature/*`, `fix/*`, `chore/*`: short-lived work branches that target `develop` unless a change is explicitly production-safe and reviewed.

## Verification flow

1. Local or branch validation uses `npm run verify` as the canonical application gate.
2. CI keeps the existing parallel jobs because they provide precise diagnostic evidence.
3. A final canonical gate consumes those job results and becomes the single promotion signal.
4. Diagnostics explain failures; they do not replace the canonical gate.
5. Repair automation may propose or validate changes, but it does not define release truth.
6. Promotion uses evidence from the exact commit being promoted.

## Complexity controls

- Do not create a second verification command for the same application layer.
- Do not copy a diagnostic subsystem into another branch architecture; integrate by contract.
- Do not delete legacy evidence or repair artifacts while consolidating ownership.
- Do not merge `experimental` wholesale into `main`.
- Every new gate must have one owner, one output contract, and one place in the promotion flow.

## Ownership map

| Concern | Canonical owner | Output |
|---|---|---|
| Application correctness | `npm run verify` | exit status + CI evidence |
| Static checks | CI typecheck/lint/build/audit jobs | job results |
| Browser behavior | isolated E2E matrix | per-tool artifacts |
| Security | CodeQL + production audit + configured supply-chain scan | security job evidence |
| Diagnostics | diagnostic scripts and artifacts | explanation/evidence |
| Repair | experimental repair tooling | candidate patch/evidence |
| Promotion | final canonical gate | pass/fail promotion signal |
| Production | `main` | releasable source |

## Non-destructive consolidation

Consolidation means adding contracts and routing existing components through them. It does not require deleting branches, scripts, memory, artifacts, or historical PRs. Cleanup can be considered only after the replacement path has been proven over multiple green runs.
