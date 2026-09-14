# FLIXO AI — Persistent Projects & Agent Work Map

**First work gate for every agent.** Read this file before implementation. It is the persistent cross-session task map.

`المهام.md` is the mandatory open-task gateway and must be read immediately after this file.

## CURRENT STATE

```text
BRANCH = main
ACTUAL MAIN SHA = fb6c302a612c4b9e5fcbeac3fdcbd0d2183d61bb
ACTIVE TASK = ADMIN-004
ADMIN-003 = CLOSED / VERIFIED
ADMIN-004 = ACTIVE / FAIL-CLOSED HARDENING
FRESH CI FOR CURRENT SHA = PENDING
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
| TEST-001 | CANDIDATE | Inventory ownership |
| DEBT-001 | CANDIDATE | Fresh-failure/value review |
| TOOL-EXPANSION | CANDIDATE | Select smallest proven candidate |

## ADMIN-003

```text
CLOSED / VERIFIED
closure SHA = 80ae6d8501a77fefa2915946782038355e5be3ac
canonical CD run = 34796825957
```

## ADMIN-004

Invariant:

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

Current implementation remains fail-closed:
`execution-policy.ts` denies non-preview writes;
`execution-plan.ts` is `PREVIEW_ONLY` with `enabled=false`;
`execution-preview.ts` is GET-only and does not mutate production.

Targeted regression now also proves:

```text
POST / execution-preview → 405 method_not_allowed
```

Current SHA:
`fb6c302a612c4b9e5fcbeac3fdcbd0d2183d61bb`

Fresh canonical CI:
`PENDING`

Production mutation:
`DISABLED`

## EVIDENCE RULE

`EXACT SHA ∧ CLEAN WORKTREE ∧ REQUIRED TEST PASS ∧ FRESH CURRENT EVIDENCE`

No GREEN outside these conditions.
