# FLIXO AI — Persistent Projects & Agent Work Map

**First work gate for every agent.** Read this file before implementation. It is the persistent cross-session task map.

`المهام.md` is the mandatory open-task gateway and must be read immediately after this file.

## CURRENT STATE

```text
BRANCH = main
ACTIVE TASK = ADMIN-005
ADMIN-003 = CLOSED / VERIFIED
ADMIN-004 = CLOSED / VERIFIED
ADMIN-004 CLOSURE SHA = b036327855222f4c11db0cfc8a1657167e4231be
ADMIN-004 CANONICAL TEST RUN = 34798018758
ADMIN-004 VERCEL DEPLOYMENT = EXTERNAL / RATE-LIMIT BLOCKED
CURRENT MAIN SHA = 5bbd68172680b4629c7d4cf8e652832910b6fdcc
```

## TASK QUEUE

| ID | Status | Next deterministic action |
|---|---|---|
| ADMIN-003 | CLOSED / VERIFIED | Preserve canonical read-only centers |
| ADMIN-004 | CLOSED / VERIFIED | Preserve fail-closed execution boundary |
| ADMIN-005 | IMPLEMENTED / VERIFICATION PENDING | Fresh exact-SHA CI/certification proof of the server boundary and browser-bundle security invariant |
| ADMIN-006 | LOCKED | Activate after ADMIN-005 proof |
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
CLOSED / VERIFIED
closure SHA = b036327855222f4c11db0cfc8a1657167e4231be
canonical test/certification run = 34798018758
execution remains fail-closed
production mutation = DISABLED
```

Contract:

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

Verified implementation:

```text
execution-policy.ts  = non-preview writes DENY
execution-plan.ts    = PREVIEW_ONLY / enabled=false
execution-preview.ts = GET-only / no mutation
```

Verified targeted proof:

```text
execution-policy regression
+ server-boundary regression
+ POST / execution-preview → 405 method_not_allowed
+ rollback proof requirement
+ verification/evidence requirement in execution plan
```

The Vercel status for this SHA is an external build-rate-limit condition and is not treated as application GREEN or application failure.

## ADMIN-005

```text
IMPLEMENTED / VERIFICATION PENDING
implementation SHA = 5bbd68172680b4629c7d4cf8e652832910b6fdcc
base SHA = de07ac765159a4ba328b4d33d971b8d13db9d4c4
RCA = ADMIN-005-CLIENT-BUNDLE-BOUNDARY-001
```

Authoritative roadmap evidence:
`docs/ADMIN-CONTROL-PLANE-MASTER-PLAN.md`

Implemented causal repair:
`build -> dist/assets/*.js -> security boundary validator`

The production build now fails closed when browser JavaScript contains server-side Admin secret/boundary markers such as `ADMIN_SESSION_SECRET`, `/api/admin/`, `authorizeAdminRequest`, `createHmac`, or `signAdminSession`.

The validator remains part of the existing production `build` script, immediately after `vite build`.

Current verification:
`CI run 34800176880 = in progress`

Closure remains blocked until fresh exact-SHA CI/certification evidence proves the invariant on `main @ 5bbd68172680b4629c7d4cf8e652832910b6fdcc`.

Current roadmap execution posture:
`Controlled Execution = LOCKED`

## GOVERNANCE

Bounded single-owner work may execute directly on `main`. Use `execution` only for materially risky, broad, conflict-prone, architectural, or production-sensitive isolation. Exact-SHA, regression, authorization, rollback, evidence, and certification requirements remain mandatory.

## DELETION

A task may leave the open queue only after merge-to-main, exact-SHA proof, targeted tests, required CI/certification, invariant proof, no dependent repair, closure evidence, history update, and next-task update.

## EVIDENCE

`EXACT SHA ∧ CLEAN WORKTREE ∧ REQUIRED TEST PASS ∧ FRESH CURRENT EVIDENCE`

No GREEN outside these conditions.
