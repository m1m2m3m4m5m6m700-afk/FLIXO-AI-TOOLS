# FLIXO AI — Persistent Projects & Agent Work Map

**First work gate for every agent.** Read this file before implementation. It is the persistent cross-session task map.

## 0. Current state

```text
BRANCH                 = main
EXACT MAIN SHA         = resolved from Git at session start
LAST PROVEN CI         = 34768609927
LAST PROVEN SHA        = e19c494f5793ec06dd806dbe8c321c990f74374b
LAST PROVEN RESULT     = SUCCESS
CURRENT MAP COMMIT     = this file's commit; it is documentation only
```

`main` is authoritative. Because this file creates a new commit when updated, agents must always resolve the actual `main` SHA before acting.

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
| **ARCH-001** | Shared Build Boundary Contract | **IMPLEMENTED / VERIFICATION PENDING** | Proven on `e19c494f…`; build-boundary validator is inside existing `BUILD-001`; CI `34768609927` passed completely on that SHA | Re-certify on the current `main` SHA created by this map update, then retire |
| **AGENT-001** | Persistent Agent Project Gateway | **IMPLEMENTED / VERIFICATION PENDING** | `PROJECTS.md` + `AGENTS.md` gateway and marker repair proven on `e19c494f…`; CI `34768609927` passed | Re-certify on the current `main` SHA, then retire |
| **ADMIN-001** | Admin Control Plane Phase 0/1 | **IMPLEMENTED / VERIFICATION PENDING** | Server boundary has exact test proof: 12 fail-closed/auth/correlation/overview cases passed on `e19c494f…` | Re-certify on current `main`; no duplicate tests |
| **ADMIN-002** | Real persistence + evidence ledger | **BLOCKED** | Canonical production provider is not currently provable from connected controls; no database/ORM/client path exists in repo; connected Supabase project is `INACTIVE`; connected Vercel team lists no projects | Establish production provider + binding provenance; inspect schema; only then implement one canonical write/read-back path |
| ADMIN-003 | Admin Truth / Command / Security / Contract / Operations / Incident Centers | LOCKED | Depends on proven persistence/evidence foundation | Activate after ADMIN-002 |
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

Current repository/provider discovery proves a blocker, not a persistence implementation:

- No database/ORM dependency exists in `package.json`.
- No canonical Supabase/Postgres/Drizzle connection path is established in repository code.
- `.vercel/project.json` is absent.
- Connected Vercel team `flexo1` exposes no projects through the available control plane.
- Connected Supabase project `zrpsmgdrtwzrhkjwwujo` is `INACTIVE`; it is not treated as production.
- `.env.example` exposes no database binding variable.

Therefore **do not** create a database, ORM, migration, parallel store, guessed binding, or fake/in-memory production persistence.

Required unblock proof:

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
No task is retired by this documentation refresh.
Reason: current main SHA differs from the last proven SHA.
```

Format:

`ID | closedAt | mainSha | ciRun | invariant | evidence | result`

## 9. Session handoff

```text
LAST SESSION:
  sessionId      = <fill>
  agentId        = <fill>
  entrySha       = <fill>
  exitSha        = <fill>
  task           = <fill>
  status         = <fill>
  RCA            = <fill>
  evidence       = <fill>
  blocker        = <fill>
  nextAction     = <fill>
  remainingWork  = <fill>
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

No `GREEN` claim outside those conditions.