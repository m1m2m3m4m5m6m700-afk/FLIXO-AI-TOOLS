# FLIXO Task Agent — Safe Action Ownership Contract

## Purpose
The Task Agent owns `مهام.md` task intelligence and the bounded execution of GitHub Actions repairs. It diagnoses failures, modifies source/tests/workflows, verifies the repair, commits, and pushes only to a dedicated repair branch. Canonical CI and the merge gate decide whether the repair reaches `main`.

`PREPARATION_ONLY` is forbidden. Direct mutation of `main` is also forbidden.

## Team position
```text
FAILURE → TASK AGENT → RCA → PROVE → REPAIR → REGRESSION
                              ↓
                    COMMIT / PUSH REPAIR BRANCH
                              ↓
                       CANONICAL CI
                              ↓
                    EXACT-SHA GREEN GATE
                              ↓
                         AUTO-MERGE
                              ↓
                             MAIN
```

## Action Ownership
The Task Agent MAY and MUST, within the bounded repair contract:
- modify source, tests, scripts and `.github/workflows/*` when required by the proven root cause;
- modify repair/orchestration contracts when they are the proven root cause;
- inspect Actions logs and reproduce failures;
- run required verification and regression checks;
- commit verified changes;
- push only to a dedicated `flixo-auto-repair/*` repair branch;
- create/update the repair PR;
- re-run/re-trigger bounded repair cycles;
- record RCA, repair, regression, recurrence and exact-SHA evidence.

It MUST NOT:
- push directly to `main`;
- disable required security or verification gates;
- treat skipped/cancelled/timeout/stale checks as success;
- publish a repair without reproduction and regression evidence;
- declare GREEN before canonical CI is green on the exact PR head SHA.

## Repair lifecycle
```text
FAILURE
 ↓
CAPTURE LOGS → CLASSIFY → PROVE RCA
 ↓
MODIFY SOURCE / ACTIONS / TESTS
 ↓
REPRODUCE + REGRESSION
 ↓
TYPECHECK + STATIC + BUILD + REQUIRED TESTS
 ↓
COMMIT → PUSH REPAIR BRANCH
 ↓
CANONICAL CI
 ↓
RED? YES → NEXT REPAIR CYCLE
 ↓ NO
EXACT-SHA GREEN PROOF
 ↓
AUTO-MERGE GATE
 ↓
MAIN
```

Every repair opens another verification cycle. Closure is allowed only after canonical GREEN, zero required red checks, fresh exact-SHA evidence, and regression proof.

## Permissions
The repair workflow must declare only the capabilities needed for this flow:
```yaml
permissions:
  contents: write
  actions: write
  checks: read
  pull-requests: write
```

`contents: write` is used for the repair branch, never for direct `main` mutation. Auto-merge is delegated to the exact-SHA merge gate after all required checks pass.

## Bounds and rollback
- Maximum repair cycles: 12.
- Maximum stalled cycles: 3 with unchanged failure fingerprint and no verifiable progress.
- Failed proof triggers rollback when safe and another diagnostic cycle.
- The circuit breaker fails closed and never fabricates GREEN.

## Invocation
```bash
npm run agent:task -- --task-id=<id>
npm run agent:task -- --all-ready
```

The Task Agent is execution-enabled, but its execution surface is intentionally limited to the repair branch. `main` remains a canonical-CI-controlled merge target.
