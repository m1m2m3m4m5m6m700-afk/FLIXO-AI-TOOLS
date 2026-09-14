# FLIXO AI — Persistent Projects & Agent Work Map

**First work gate for every agent.** Read this file before implementation. It is the persistent cross-session task map.

`المهام.md` is the mandatory open-task gateway and must be read immediately after this file.

## CURRENT STATE

```text
BRANCH = main
ACTIVE TASK = ADMIN-004
ADMIN-003 = CLOSED / VERIFIED
ADMIN-004 = ACTIVE / FAIL-CLOSED HARDENING
LAST RESOLVED MAIN SHA = 53dbacdb78b8ae68e45bc491653b702093bf8bbe
CURRENT MAP UPDATE = documentation follows repository ref; re-resolve main SHA at every session entry
FRESH CI FOR LAST RESOLVED SHA = PENDING
```

## PRIORITY QUEUE

| ID | Status | Next deterministic action |
|---|---|---|
| ADMIN-003 | CLOSED / VERIFIED | Preserve canonical read-only centers |
| ADMIN-004 | ACTIVE | Fresh canonical CI on current main, then reversible execution/evidence hardening without production mutation |
| ADMIN-005 | LOCKED | Activate after ADMIN-004 proof |
| ADMIN-006 | LOCKED | Activate after ADMIN-005 |
| ADMIN-007 | LOCKED | Activate after ADMIN-006 |
| ADMIN-008 | LOCKED | Final production certification |
| BUILD-002 | CANDIDATE | Fresh artifact graph analysis |
| I18N-001 | CANDIDATE | Runtime ownership trace |
| TEST-001 | CANDIDATE | Ownership inventory |
| DEBT-001 | CANDIDATE | Fresh-failure/value review |
| TOOL-EXPANSION | CANDIDATE | Select smallest proven candidate |

## ADMIN-003

```text
CLOSED / VERIFIED
closure SHA = 80ae6d8501a77fefa2915946782038355e5be3ac
canonical CD run = 34796825957
```

## ADMIN-004

```text
authentication
→ deterministic command/target
→ policy
→ preview
→ rollback requirement
→ approval when required
→ execution boundary
→ verification
→ evidence
→ audit
→ rollback proof
```

Current implementation is fail-closed:

```text
execution-policy.ts  = non-preview writes DENY
execution-plan.ts    = PREVIEW_ONLY / enabled=false
execution-preview.ts = GET-only / no mutation
```

Current targeted proof includes explicit `POST / execution-preview → 405 method_not_allowed`.

Last resolved candidate SHA:
`53dbacdb78b8ae68e45bc491653b702093bf8bbe`

Fresh canonical CI:
`PENDING`

Production mutation:
`DISABLED`

## GOVERNANCE

Bounded single-owner work may execute directly on `main`. `execution` is used only for materially risky, broad, conflict-prone, architectural, or production-sensitive isolation. Exact-SHA, regression, authorization, rollback, evidence, and certification requirements are unchanged.

## DELETION

No task leaves the open queue until merged-to-main, exact-SHA proof, targeted tests, required CI/certification, invariant proof, no dependent repair, closure evidence, history update, and next-task update are all satisfied.

## EVIDENCE

`EXACT SHA ∧ CLEAN WORKTREE ∧ REQUIRED TEST PASS ∧ FRESH CURRENT EVIDENCE`

No GREEN outside these conditions.
