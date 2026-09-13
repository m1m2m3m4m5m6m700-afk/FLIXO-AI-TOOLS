# FLIXO AI — Persistent Projects & Agent Work Map

**First work gate for every agent.** Read this file before implementation. It is the persistent cross-session task map.

## 0. Current state

```text
BRANCH                       = main
LAST VERIFIED MAIN SHA       = e19c494f5793ec06dd806dbe8c321c990f74374b
CURRENT MAP COMMIT            = this file's commit; resolve `main` directly at session start
CANONICAL CI RUN             = 34768609927
RUN STATE WHEN MAP WAS BUILT = IN_PROGRESS
LAST FAILED VERIFICATION     = 34768345917
LAST FAILED SHA              = c35c8617e5399fb205c247c2260e47d2e640163d
LAST FAILURE RCA             = RC-AGENT-MARKER-001
LAST FAILURE FIX             = e19c494f5793ec06dd806dbe8c321c990f74374b
```

The exact current `main` ref is always authoritative. Because updating this file itself creates a new commit, agents must resolve `main` from Git at every session instead of treating the SHA printed above as self-updating state.

## 1. Operating contract

- `ACTIVE` is the only execution-authorized project status.
- `LOCKED` means dependency-gated, not forgotten.
- `CANDIDATE ≠ ACTIVE`.
- `DEFERRED / SUPERSEDED ≠ forgotten`.
- Completion requires exact-SHA proof, not code presence.
- Every material unfinished item must have a deterministic next action here.
- New work discovered during execution must be classified here before it becomes scope.
- Do not create duplicate validators, registries, truth stores, owners, or test engines when an authoritative boundary already exists.
- `main` is never a scratchpad.
- Never promote a task to `CLOSED / STABLE` from local, branch-only, stale, partial, cancelled, inferred, or bypassed evidence.

## 2. Task retirement / deletion protocol

A task may be **removed from the open task queue** only after all conditions below are simultaneously true:

1. Its implementation is actually merged into `main`.
2. The actual `main` exact SHA is the proven merge/result SHA for the task.
3. All required CI and certification checks complete successfully on that exact `main` SHA.
4. No required scope was hidden, skipped, weakened, bypassed, or converted to PASS.
5. The task invariant is proven and its evidence is traceable to exact SHA, test, artifact, and run.
6. No unresolved dependent repair remains owned by the task.
7. A compact immutable closure record is written in `## Closed History`.
8. The next dependent task is updated before the retired task is removed from the open queue.

**Deletion means deletion from the active/open queue, not erasure of engineering memory.** RCA, invariant, proof, closure SHA, and evidence must remain in `Closed History`.

Never retire a task merely because:
- a branch is green;
- a PR is green;
- local tests pass;
- code exists;
- a job is queued/in progress;
- a historical run passed.

When a task is replaced without proof of completion, mark it `SUPERSEDED`, `DEFERRED`, or `BLOCKED` and retain it. When fresh evidence reopens the same defect, restore the original task ID instead of creating a duplicate.

## 3. Current priority queue

| ID | Project | Status | Exact state | Next deterministic action |
|---|---|---|---|---|
| **ARCH-001** | Shared Build Boundary Contract — eliminate recurring lazy/shared chunk cycles | **ACTIVE** | Build-boundary validator is part of the existing `BUILD-001`; run `34768609927` on `e19c494f…` has Static+Build and all currently completed browser shards passing; DEEP execution was still in progress when this map was refreshed | Re-read final run conclusion on the exact `main` SHA; retire only after complete certification |
| **AGENT-001** | Persistent Agent Project Gateway | **ACTIVE** | `PROJECTS.md` + `AGENTS.md` gateway implemented; marker contract repaired in `e19c494f…`; same canonical run was still completing | Verify final exact-SHA CI/certification, then retire under the retirement protocol |
| **ADMIN-001** | Admin Control Plane Phase 0/1 verification | **LOCKED** | Admin foundation/server boundary exists; current certification is not yet proven | Activate after ARCH-001 and AGENT-001 exit proof; verify auth/session/capability/fail-closed/server-secret/HTTP-method contracts |
| ADMIN-002 | Admin real persistence + evidence ledger | LOCKED | Phase 2 not proven against canonical production persistence | Activate only after ADMIN-001 exit proof |
| ADMIN-003 | Admin Truth / Command / Security / Contract / Operations / Incident centers | LOCKED | Product modules defined; certification not established | Activate phase-by-phase after persistence/evidence foundation |
| ADMIN-004 | Admin controlled execution + rollback | LOCKED | Controlled execution intentionally gated | Activate only after authorization/policy/evidence/audit/rollback proofs |
| ADMIN-005 | Admin Change / Approval / Incident consolidation | LOCKED | Phase 6 not started | Activate after ADMIN-004 |
| ADMIN-006 | Admin Truth Graph | LOCKED | Phase 7 not started | Activate after real provenance graph exists |
| ADMIN-007 | Controlled AI Assistant | LOCKED | Phase 8 not started | Activate after deterministic authorization/evidence/execution is stable |
| ADMIN-008 | Admin production certification | LOCKED | Phase 9 not complete | Certify one exact candidate SHA after all Admin proofs are fresh |
| BUILD-002 | Residual lazy chunk → entry dependency candidates | CANDIDATE | Historical artifact observation only; no new defect proven | Rebuild/inspect the artifact graph and classify every edge before code changes |
| I18N-001 | MutationObserver ownership reanalysis | CANDIDATE | Multiple scoped/technical observers exist; no current regression proven | Trace active runtime ownership/lifecycle; repair only a proven recurring failure |
| TEST-001 | Playwright surface ownership cleanup | CANDIDATE | Direct `@playwright/test` imports remain in config/fixtures/helpers by design | Inventory ownership and remove only unauthorized duplicate execution surfaces |
| DEBT-001 | Technical-debt audit candidates | CANDIDATE | Inventory-backed candidates exist | Review only candidates tied to fresh failure or proven zero-value surface |

## 4. ARCH-001 — Shared Build Boundary Contract

### Root cause being closed

Historical recurring failure class:

`APP / ROUTE REGISTRY → dynamic lazy tool → shared leaf → main / entry chunk`

This can create an invalid lazy-chunk topology or make a dynamic module depend on a higher-level entry chunk that is not independently resolvable in the browser. The Firefox G4 failure that triggered PR #675 was the concrete proven instance.

### Target invariant

```text
APP / BOOTSTRAP
  ├─ ROUTER / REGISTRY
  └─ GLOBAL RUNTIME
        ↓
  LAZY TOOL BOUNDARIES
        ↓
  SHARED LEAF MODULES
        ↓
  PURE CONTRACTS / UTILITIES
```

Forbidden direction:

```text
Shared → App Bootstrap
Shared → Router / Route Registry
Shared → Global DOM Writer
Shared → Global runtime installer
Shared → unrelated Tool Runtime
Lazy Tool → App entry chunk
```

Allowed direction:

```text
Main / Router / Tool → Shared
Shared → Pure Contract / Utility
```

### Enforcement

Do **not** create a second CI gate. `scripts/ci/validate-build-chunk-boundaries.mjs` remains owned by the existing production `BUILD-001` assertion after the Vite build.

### Exit proof

`validator detects forbidden graph shape → current build passes → browser regression passes → canonical exact-SHA CI/certification passes`

## 5. ADMIN-001..008 — Admin Control Plane map

Primary authority: `docs/ADMIN-CONTROL-PLANE-MASTER-PLAN.md`.

Mission: operational truth, governance, security, controlled execution, and evidence. It is not a decorative dashboard and must not restore the retired Admin architecture.

Required path:

`Browser Admin UI → Server/Admin API Boundary → Identity + HTTP-only Session → Capability Authorization → Policy → Domain/Data Adapters → Existing contracts/persistence → Evidence → Audit → Controlled execution/rollback`

Hard exclusions:

`legacy Admin restoration`, `localStorage authentication`, `second database stack without proof`, `fake metrics`, `client-only security`, `unrestricted AI execution`, `speculative microservices`, and `page-by-page duplicate test suites`.

## 6. Historical repair memory

These remain repository memory and may be reactivated only by fresh evidence:

- Shared lazy-chunk / dependency-topology failures → current P0 closure project `ARCH-001`.
- I18n observer storms / multiple runtime writers → historically repaired; reanalysis remains `I18N-001` CANDIDATE.
- Route/document locale ownership drift → historically repaired; preserve one authoritative owner.
- Tool H1 / SEO name drift → historically repaired; preserve canonical registry/SEO ownership.
- Duplicate CI/test execution → historically consolidated; do not reintroduce a second execution owner.
- False-green matrix topology → historically repaired; exact SHA and complete graph remain mandatory.
- Playwright evidence serialization loss → recently repaired; preserve object-level runtime evidence.
- Admin route closure conflict → repaired; do not weaken the legacy closure validator.
- Dependency / technical-debt drift → inventory-backed review only.
- Agent governance marker drift → `RC-AGENT-MARKER-001` repaired in `e19c494f…`; do not weaken the validator.

## 7. Closed History

No task is retired by this map refresh. The current canonical run was not yet fully certified when the queue was rebuilt.

Future immutable format:

`- ID | closedAt | mainSha | ciRun | invariant | evidence | result`

## 8. Session handoff

Every agent must update this block before leaving unfinished work.

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

## 9. Agent start protocol

```text
READ PROJECTS.md
→ READ AGENTS.md
→ INGEST HANDOFF
→ RESOLVE ACTUAL main SHA
→ IDENTIFY ACTIVE TASK
→ INSPECT CONTRACT / OWNER / RCA
→ EXECUTE MINIMAL PROVEN FIX
→ TEST IMMEDIATELY
→ VERIFY EXACT SHA
→ UPDATE PROJECTS.md
→ RETIRE TASK ONLY IF RETIREMENT PROTOCOL PASSES
```

## 10. Current CI evidence snapshot

At the time of this map refresh, canonical run `34768609927` was still `IN_PROGRESS` on `e19c494f5793ec06dd806dbe8c321c990f74374b`.

Known completed results:

- Static + Build — `SUCCESS`
- Browser FAST — Chromium shards 1/2 — `SUCCESS`
- Browser FAST — Firefox shards 1/2 — `SUCCESS`
- Browser FAST — WebKit shards 1/2 — `SUCCESS`
- Browser DEEP — Chromium shards 1/2/3 — `SUCCESS`
- Browser DEEP — Firefox shards 1/2/3 — `SUCCESS`
- Browser DEEP — WebKit shards 1/2/3 — `SUCCESS`

At refresh time, the overall run had not yet published its final certification/conclusion. Therefore `ARCH-001` and `AGENT-001` remain `ACTIVE` until the final exact-SHA result is read and the retirement criteria are met.

## 11. Evidence rule

No task may be promoted to `CLOSED / STABLE` without:

`EXACT SHA ∧ CLEAN WORKTREE ∧ REQUIRED TEST PASS ∧ FRESH CURRENT EVIDENCE`
