# FLIXO AI — Persistent Projects & Agent Work Map

**First work gate for every agent.** Read this file before implementation. It is the persistent cross-session task map.

`المهام.md` is the mandatory open-task gateway and must be read immediately after this file.

## 0. Current state

```text
BRANCH                 = main
ACTUAL MAIN SHA        = 4c46cf78de21fcd6e1bb4444d09226e81775dcc4
LAST PROVEN CI SHA     = 80ae6d8501a77fefa2915946782038355e5be3ac
LAST PROVEN CI         = 34796825957
LAST PROVEN RESULT     = SUCCESS
CURRENT CODE NOTE      = ADMIN-004 fail-closed execution boundary is active. execution-preview accepts GET only, policy denies non-preview writes, and the server boundary regression proves POST rejection. Fresh canonical CI for 4c46cf7… remains pending.
CURRENT MAP COMMIT     = this file's resulting commit; documentation only
```

`main` is authoritative. The current code SHA above is not certified until required CI and task-specific evidence are fresh and exact.

## 1. Operating contract

- `ACTIVE` is the only execution-authorized status.
- `LOCKED` means dependency-gated, not forgotten.
- `CANDIDATE ≠ ACTIVE`.
- Completion requires Exact-SHA proof.
- No speculative implementation when provenance, owner, or invariant is unproven.
- Do not create duplicate validators, registries, truth stores, owners, or test engines.
- Never mark `CLOSED / STABLE` from branch-only, stale, partial, inferred, or bypassed evidence.
- External deployment-provider failures remain non-blocking for independent repository execution and are blockers only where live provider evidence is explicitly required.
- `المهام.md` owns the open execution queue; `PROJECTS.md` owns project state and closed history. The two must remain consistent.

## 2. Current priority queue

| ID | Project | Status | Current truth | Next deterministic action |
|---|---|---|---|---|
| ARCH-001 | Shared Build Boundary Contract | CLOSED / VERIFIED | Exact-SHA proof on `b089bd0…`; existing `BUILD-001` validator passed | Preserve invariant |
| AGENT-001 | Persistent Agent Project Gateway | CLOSED / VERIFIED | Gateway protections verified | Preserve single gateway |
| ADMIN-001 | Admin Control Plane Phase 0/1 | CLOSED / VERIFIED | Fail-closed boundary verified | Preserve canonical boundary |
| ADMIN-002 | Real persistence + evidence ledger | CLOSED / VERIFIED | Persistence/write/read-back closure proven on `13da1202…` | Preserve persistence invariant; live proof belongs ADMIN-008 |
| ADMIN-003 | Admin Truth / Command / Security / Contract / Operations / Incident Centers | CLOSED / VERIFIED | Canonical read-only centers and authorization proven; canonical CD run `34796825957` succeeded | Preserve canonical read-only centers |
| **ADMIN-004** | **Admin Controlled Execution + Rollback** | **ACTIVE** | Fail-closed policy + preview route hardened; non-preview writes remain disabled | Fresh canonical CI on `4c46cf7…`, then continue reversible execution/evidence hardening |
| ADMIN-005 | Admin Change / Approval / Incident consolidation | LOCKED | Depends on ADMIN-004 | Activate after controlled execution proof |
| ADMIN-006 | Admin Truth Graph | LOCKED | Depends on ADMIN-005 | Activate after provenance graph proof |
| ADMIN-007 | Controlled AI Assistant | LOCKED | Depends on ADMIN-006 | Activate after deterministic authorization/execution/evidence stability |
| ADMIN-008 | Admin production certification | LOCKED | Final Admin certification not complete | Certify one exact candidate SHA including live deployed-SHA evidence |
| BUILD-002 | Residual lazy chunk → entry dependency candidates | CANDIDATE | No current defect proven | Fresh artifact graph analysis |
| I18N-001 | MutationObserver ownership reanalysis | CANDIDATE | No current regression proven | Runtime ownership trace |
| TEST-001 | Playwright surface ownership cleanup | CANDIDATE | No current defect proven | Inventory ownership |
| DEBT-001 | Technical-debt audit candidates | CANDIDATE | Inventory-backed only | Review fresh-failure/value candidates |
| TOOL-EXPANSION | Controlled 180-tool expansion backlog | CANDIDATE | Backlog only | Select smallest proven candidate |

## 3. Admin execution contract

Primary authority: `docs/ADMIN-CONTROL-PLANE-MASTER-PLAN.md`.

```text
Browser Admin UI
→ Server/Admin API Boundary
→ Identity + HTTP-only Session
→ Capability Authorization
→ Policy
→ Domain/Data Adapters
→ Existing Persistence
→ Evidence
→ Audit
→ Controlled Execution / Rollback
```

Repository proof and live deployment proof remain separate lanes.

## 4. ADMIN-003 closure

```text
ADMIN-003 = CLOSED / VERIFIED
closure SHA = 80ae6d8501a77fefa2915946782038355e5be3ac
canonical CD run = 34796825957
```

Canonical centers are read-only, center-specific authorization is verified, and the fresh CD run proved production identity on the exact prior closure SHA.

## 5. ADMIN-004 current state

### Invariant

```text
authenticated request
→ deterministic command/target
→ policy evaluation
→ preview
→ rollback requirement
→ approval when required
→ execution boundary
→ verification
→ evidence
→ audit
→ rollback proof
```

### Current implementation

`api/admin/execution-policy.ts` denies every non-preview write, including when rollback and approval are supplied.

`api/admin/execution-plan.ts` returns `PREVIEW_ONLY` with `enabled=false` and records rollback/approval/audit requirements.

`api/admin/execution-preview.ts` is GET-only, authenticates through the existing Admin boundary, and produces preview data without mutation.

### Current targeted proof

`scripts/test-admin-execution-policy.mjs` covers READ, missing inputs, rollback requirement, approval requirement, and final `execution_disabled`.

`scripts/test-admin-server-boundary.mjs` covers authorization/correlation/read-only centers/preview behavior and explicitly proves:

```text
POST / execution-preview → 405 method_not_allowed
```

Current candidate SHA:
`4c46cf78de21fcd6e1bb4444d09226e81775dcc4`

Fresh canonical CI:
`PENDING`

Production mutation:
`DISABLED`

## 6. CD evidence

Canonical CD run `34796825957` on `80ae6d8501a77fefa2915946782038355e5be3ac` completed successfully, including immutable deployment, production identity proof, and deployment evidence upload.

A standalone Vercel quota status is infrastructure state and must not be relabeled as an application failure.

## 7. Closed History

```text
ARCH-001 | 2026-09-13 | b089bd0a4056b04a1376a979c726f33e47944189 | 34771149429 | BUILD-001 shared build boundary | PASS | CLOSED
AGENT-001 | 2026-09-13 | b089bd0a4056b04a1376a979c726f33e47944189 | 34771149429 | Persistent project gateway | PASS | CLOSED
ADMIN-001 | 2026-09-13 | b089bd0a4056b04a1376a979c726f33e47944189 | 34771149429 | Fail-closed Admin boundary | PASS | CLOSED
ADMIN-002 | 2026-09-13 | 13da1202f44c6d314120d260ef65acf2fc69a7e9 | 34783338419 | Persistence + evidence ledger | PASS | CLOSED
ADMIN-003 | 2026-09-14 | 80ae6d8501a77fefa2915946782038355e5be3ac | 34796825957 | Canonical Admin read-only centers | PASS | CLOSED
```

## 8. Session handoff

```text
CURRENT TASK = ADMIN-004
STATUS       = ACTIVE
ENTRY SHA    = 80ae6d8501a77fefa2915946782038355e5be3ac
CURRENT SHA  = 4c46cf78de21fcd6e1bb4444d09226e81775dcc4
LAST PROVEN  = 34796825957 on 80ae6d8…
NEXT ACTION  = Fresh canonical CI on 4c46cf7… then continue deterministic reversible execution/evidence hardening
```

## 9. Evidence rule

```text
EXACT SHA ∧ CLEAN WORKTREE ∧ REQUIRED TEST PASS ∧ FRESH CURRENT EVIDENCE
```

No GREEN claim outside these conditions.
