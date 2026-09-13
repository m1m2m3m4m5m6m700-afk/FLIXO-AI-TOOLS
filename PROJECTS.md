# FLIXO AI — Persistent Projects & Agent Work Map

**First work gate for every agent.** Read this file before implementation. It is the persistent cross-session task map.

## 0. Current state

```text
BRANCH                 = main
ACTUAL MAIN SHA        = c0c37134200d247cf5a363995f52a416e7afc6d3
LAST PROVEN CI SHA     = b089bd0a4056b04a1376a979c726f33e47944189
LAST PROVEN CI         = 34771149429
LAST PROVEN RESULT     = SUCCESS
CURRENT CODE NOTE      = main contains the Admin persistence adapter / overview probe and package/CI trust repairs; production certification remains blocked by external Vercel deployment rate limit
CURRENT MAP COMMIT     = this file's commit; it is documentation only
```

`main` is authoritative. The current code SHA above is not production-certified until required CI and production evidence are fresh and exact.

## 1. Operating contract

- `ACTIVE` is the only execution-authorized status.
- `LOCKED` means dependency-gated, not forgotten.
- `CANDIDATE ≠ ACTIVE`.
- Completion requires Exact-SHA proof.
- No speculative implementation when provenance, owner, or invariant is unproven.
- Do not create duplicate validators, registries, truth stores, owners, or test engines.
- Never mark `CLOSED / STABLE` from branch-only, stale, partial, inferred, or bypassed evidence.

## 2. Task retirement / deletion protocol

Remove a task from the open queue only when:

`MERGED TO MAIN ∧ EXACT MAIN SHA PROVEN ∧ REQUIRED CI/CERTIFICATION PASS ∧ INVARIANT PROVEN ∧ NO DEPENDENT REPAIR ∧ CLOSED HISTORY RECORDED ∧ NEXT TASK UPDATED`

Removal means removal from the active queue, not deletion of engineering memory. RCA, invariant, proof, closure SHA, CI run, and evidence remain in `Closed History`.

A green branch/PR, local pass, code existence, queued job, or historical run never retires a task.

## 3. Current priority queue

| ID | Project | Status | Current truth | Next deterministic action |
|---|---|---|---|---|
| **ARCH-001** | Shared Build Boundary Contract | **CLOSED / VERIFIED** | Exact-SHA proof on `b089bd0…`; existing `BUILD-001` boundary validator passed in full CI certification `34771149429` | Preserve invariant; no new gate |
| **AGENT-001** | Persistent Agent Project Gateway | **CLOSED / VERIFIED** | Gateway/marker protections remained valid on exact SHA `b089bd0…`; full CI certification `34771149429` passed | Preserve single gateway owner; no duplicate validator |
| **ADMIN-001** | Admin Control Plane Phase 0/1 | **CLOSED / VERIFIED** | Existing fail-closed server-boundary contract remains verified on exact SHA `b089bd0…`; full CI certification `34771149429` passed | Preserve canonical server boundary; no duplicate tests |
| **ADMIN-002** | Real persistence + evidence ledger | **ACTIVE / PROOF PENDING** | Canonical Supabase server-side adapter and Admin overview probe are now on `main`; existing `public.flix_events` and `public.flix_admin_sessions` are reused. Production write/read-back and exact deployed SHA are not yet proven | Run required CI on exact main SHA, then production write/read-back and evidence certification |
| ADMIN-003 | Admin Truth / Command / Security / Contract / Operations / Incident Centers | LOCKED | Depends on ADMIN-002 proof | Activate after ADMIN-002 |
| ADMIN-004 | Admin controlled execution + rollback | LOCKED | Execution intentionally disabled | Activate after authorization/policy/evidence/audit/rollback proof |
| ADMIN-005 | Admin Change / Approval / Incident consolidation | LOCKED | Not started | Activate after ADMIN-004 |
| ADMIN-006 | Admin Truth Graph | LOCKED | Not started | Activate after real provenance graph |
| ADMIN-007 | Controlled AI Assistant | LOCKED | Not started | Activate after deterministic authorization/evidence/execution stability |
| ADMIN-008 | Admin production certification | LOCKED | Final Admin certification not complete | Certify one exact candidate SHA after all Admin proofs |
| BUILD-002 | Residual lazy chunk → entry dependency candidates | CANDIDATE | Historical observation only; no new defect proven | Fresh artifact graph analysis before code changes |
| I18N-001 | MutationObserver ownership reanalysis | CANDIDATE | No current regression proven | Trace runtime ownership/lifecycle before repair |
| TEST-001 | Playwright surface ownership cleanup | CANDIDATE | Direct imports remain in config/fixtures/helpers by design | Inventory ownership; remove only unauthorized execution surfaces |
| DEBT-001 | Technical-debt audit candidates | CANDIDATE | Inventory-backed only | Review only fresh-failure/zero-value candidates |

## 4. ARCH-001 — Shared Build Boundary Contract

### Historical root cause

`APP / ROUTE REGISTRY → dynamic lazy tool → shared leaf → main / entry chunk`

This created the proven Firefox G4 dynamic-import failure that triggered the shared chunk repair.

### Invariant

```text
APP / BOOTSTRAP
  ↓
LAZY TOOL BOUNDARY
  ↓
SHARED LEAF
  ↓
PURE CONTRACT / UTILITY
```

Forbidden: Shared → App/Router/Route Registry/Global runtime/unrelated Tool Runtime; Lazy Tool → App entry chunk.

### Enforcement

`scripts/ci/validate-build-chunk-boundaries.mjs` is owned by existing `BUILD-001`; no second CI gate.

## 5. ADMIN-001..008 — Admin Control Plane

Primary authority: `docs/ADMIN-CONTROL-PLANE-MASTER-PLAN.md`.

Required path:

`Browser Admin UI → Server/Admin API Boundary → Identity + HTTP-only Session → Capability Authorization → Policy → Domain/Data Adapters → Existing persistence → Evidence → Audit → Controlled execution/rollback`

Hard exclusions: legacy Admin restoration, localStorage authentication, second database stack without proof, fake metrics, client-only security, unrestricted AI execution, speculative microservices, and duplicate page-by-page suites.

## 6. ADMIN-002 — Persistence provenance decision

Provider provenance has been established operationally:

- Canonical Supabase project: `zrpsmgdrtwzrhkjwwujo`.
- Provider state: `ACTIVE_HEALTHY`.
- Existing tables discovered: `public.flix_events`, `public.flix_admin_sessions`.
- Vercel Production server bindings were added by the owner; secret values are not stored in the repository.
- Repository now contains one server-side REST/PostgREST persistence adapter and an Admin overview reachability probe.
- No new database, ORM, migration, parallel store, or client-side secret exposure was introduced.

Required closure proof remains:

`canonical production provider → production ownership → server binding (secret hidden) → schema discovery → minimal write → read-back → evidence/audit provenance → exact-SHA certification`

## 7. Historical repair memory

- Shared lazy-chunk topology → ARCH-001.
- I18n observer storms / multiple writers → historically repaired; I18N-001 remains CANDIDATE.
- Route/document locale ownership drift → repaired; preserve one owner.
- H1/SEO name drift → repaired; preserve canonical registry ownership.
- Duplicate CI execution → consolidated; do not reintroduce.
- False-green matrix → repaired; complete exact-SHA graph required.
- Playwright evidence serialization → repaired; preserve object-level evidence.
- Admin route closure conflict → repaired; do not weaken closure validator.
- Agent marker drift → repaired by `e19c494f…`; do not weaken validator.

## 8. Closed History

```text
ARCH-001 | 2026-09-13 | b089bd0a4056b04a1376a979c726f33e47944189 | 34771149429 | BUILD-001 shared build boundary | Static+Build + Certification PASS | CLOSED
AGENT-001 | 2026-09-13 | b089bd0a4056b04a1376a979c726f33e47944189 | 34771149429 | Persistent project gateway / marker protection | Static+Build + Certification PASS | CLOSED
ADMIN-001 | 2026-09-13 | b089bd0a4056b04a1376a979c726f33e47944189 | 34771149429 | Fail-closed Admin server boundary | Full CI certification PASS | CLOSED
```

## 9. Session handoff

```text
LAST SESSION:
  task         = ADMIN-002
  status       = ACTIVE / PROOF PENDING
  entrySha     = b089bd0a4056b04a1376a979c726f33e47944189
  exitSha      = c0c37134200d247cf5a363995f52a416e7afc6d3
  ciRun        = no fresh completed certification yet
  blocker      = Vercel deployment rate limit (external)
  nextAction   = complete exact-main CI proof, then production write/read-back and exact-SHA certification
```

## 10. Agent start protocol

```text
READ PROJECTS.md
→ READ AGENTS.md
→ RESOLVE ACTUAL main SHA
→ IDENTIFY ACTIVE TASK
→ INSPECT CONTRACT / OWNER / RCA
→ EXECUTE MINIMAL PROVEN ACTION
→ TEST IMMEDIATELY
→ VERIFY EXACT SHA
→ UPDATE PROJECTS.md
→ RETIRE ONLY AFTER MAIN PROOF
```

## 11. Evidence rule

`EXACT SHA ∧ CLEAN WORKTREE ∧ REQUIRED TEST PASS ∧ FRESH CURRENT EVIDENCE`

No `GREEN` claim outside these conditions.
