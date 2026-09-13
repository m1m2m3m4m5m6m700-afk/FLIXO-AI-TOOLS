# FLIXO AI — Persistent Projects & Agent Work Map

**This file is the first work gate for every agent.** Read it before implementation. It is the persistent memory of remaining work across sessions.

Current execution branch: `main`
Entry SHA after agent-gateway change: `992947a2ffcdb8f1faf66d4ae5edeacc39e365f3`
Latest previously certified main candidate: `1c2b7e3df7cd28ff5491550ad02502019ea51007` (PR #675 build/lazy-chunk repair)

## 1. Operating contract

`PROJECTS.md` is a navigation and continuity layer. It does not replace a contract, implementation file, CI test plan, or fresh evidence.

Rules:
- `ACTIVE` is the only execution-authorized project status.
- `CANDIDATE ≠ ACTIVE`.
- `DEFER ≠ forgotten`.
- Completion requires exact-SHA proof, not code presence.
- Every material unfinished item must have a deterministic next action here.
- New work discovered during execution must be classified here before it becomes scope.
- Do not create duplicate validators, registries, truth stores, owners, or test engines when an existing authoritative boundary can be extended.

## 2. Priority map

| ID | Project | Status | Authority / contract | Exact state | Next deterministic action |
|---|---|---|---|---|---|
| ARCH-001 | Shared Build Boundary Contract — eliminate recurring lazy/shared chunk cycles | ACTIVE | Existing build gate + `package.json` | Main entry advanced to `992947a…`; implementation pending | Add post-build chunk-cycle/boundary validator inside existing `BUILD-001`; prove negative regression against the historical cycle shape; run canonical CI |
| AGENT-001 | Persistent Agent Project Gateway | IMPLEMENTED / VERIFICATION PENDING | `AGENTS.md` + this file | `AGENTS.md` now directs agents to this file first | Verify exact-SHA CI; preserve this file as the first entry point |
| ADMIN-001 | Admin Control Plane Phase 0/1 verification | ACTIVE | `docs/ADMIN-CONTROL-PLANE-MASTER-PLAN.md` | Foundation/server boundary exist; production certification remains unproven | Verify exact SHA for auth/session/capability/fail-closed/server-secret/HTTP-method contracts; update Admin plan with evidence |
| ADMIN-002 | Admin real persistence + evidence ledger | LOCKED | Admin master plan Phase 2 | Not proven connected to canonical production persistence | Execute only after ADMIN-001 exit proof; use one proven persistence path |
| ADMIN-003 | Admin Truth/Command/Security/Contract/Operations/Incident centers | LOCKED | Admin master plan Phases 3–4 | Product modules defined; implementation not certified | Activate phase-by-phase only after persistence/evidence foundation is proven |
| ADMIN-004 | Admin controlled execution + rollback | LOCKED | Admin master plan Phase 5 | Execution intentionally locked | Activate only after authorization, policy, evidence, audit, and rollback proofs exist |
| ADMIN-005 | Admin Change/Approval/Incident consolidation | LOCKED | Admin master plan Phase 6 | Not started | Activate after controlled execution is proven |
| ADMIN-006 | Admin Truth Graph | LOCKED | Admin master plan Phase 7 | Not started | Activate only after underlying provenance graph is real |
| ADMIN-007 | Controlled AI Assistant | LOCKED | Admin master plan Phase 8 | Not started | Activate only after deterministic authorization/evidence/execution is stable |
| ADMIN-008 | Admin production certification | LOCKED | Admin master plan Phase 9 | Not complete | Certify one exact candidate SHA only after all Admin proofs are fresh |
| BUILD-002 | Residual lazy chunk → entry dependency candidates | CANDIDATE | Build artifact provenance | Earlier observation: `image-toolkit-*` and `tool-chain-panel-*` may import an `index-*` chunk | Re-run artifact graph on a fresh main build; classify each edge as legitimate or forbidden before changing code |
| I18N-001 | MutationObserver ownership reanalysis | CANDIDATE | Existing i18n observer contracts | Multiple scoped/technical observers exist; no current regression is proven | Trace active runtime ownership and observer lifecycle; repair only a proven recurring failure |
| TEST-001 | Playwright surface ownership cleanup | CANDIDATE | `scripts/ci/validate-playwright-surface.mjs` | Direct `@playwright/test` imports remain in config/fixtures/helpers by design; no blanket deletion allowed | Inventory direct imports and ownership; remove only duplicate/unauthorized execution surfaces |
| DEBT-001 | Technical-debt audit candidates | CANDIDATE | `scripts/ci/audit-technical-debt.mjs` | Audit is inventory-backed and intentionally classifies candidates | Review only candidates that correspond to an active failure or proven zero-value surface |

## 3. ARCH-001 — Shared Build Boundary Contract

### Root cause being closed

Historical recurring failure class:

`APP/ROUTE REGISTRY → dynamic lazy tool → shared leaf → main/entry chunk`

This creates a runtime chunk dependency cycle or a lazy module that cannot resolve independently in a browser. The Firefox G4 failure that triggered PR #675 was the concrete proven instance.

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

Forbidden dependency direction:

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
Main/Router/Tool → Shared
Shared → Pure Contract/Utility
```

### Enforcement decision

Do not create a second CI gate. The existing production build assertion remains the owner. The boundary validator executes immediately after the build and fails `BUILD-001` when the emitted chunk graph contains a cycle involving a static edge or a lazy/shared chunk that resolves back into an entry path.

### Exit proof

`mechanism proven → validator fails on the forbidden graph shape → current build passes → browser regression passes → canonical exact-SHA CI passes`.

## 4. ADMIN-001..008 — Admin Control Plane map

Primary authority: `docs/ADMIN-CONTROL-PLANE-MASTER-PLAN.md`.

Mission: operational truth, governance, security, controlled execution, and evidence—not a decorative dashboard and not the retired Admin architecture.

Required architecture:

`Browser Admin UI → Server/Admin API Boundary → Identity + HTTP-only Session → Capability Authorization → Policy → Domain/Data Adapters → Existing contracts/persistence → Evidence → Audit → Controlled execution/rollback`

Hard exclusions: legacy Admin restoration, localStorage authentication, a second database stack without proof, fake metrics, client-only security, unrestricted AI execution, speculative microservices, and page-by-page duplicate test suites.

Admin completion is blocked until the master plan's exact-SHA definition of done is fully satisfied.

## 5. Historical repair inventory

These historical classes remain part of repository memory and may be reactivated only by fresh evidence:

- Shared lazy-chunk / dependency-topology failures — current P0 root-cause closure: `ARCH-001`.
- I18n observer storms / multiple runtime writers — solved historically, but active runtime ownership remains a `CANDIDATE` for reanalysis.
- Route/document locale ownership drift — historically repaired; do not reintroduce a second owner.
- Tool H1/SEO name drift — historically repaired; treat registry/SEO ownership as canonical.
- Duplicate CI/test execution — historically consolidated; do not add a second execution owner.
- False-green matrix topology — historically repaired; exact SHA and complete graph remain mandatory.
- Playwright evidence serialization loss — recently repaired; preserve object-level runtime evidence.
- Admin route closure conflict — repaired by separating current Control Plane route from retired legacy filename/symbol; do not weaken the legacy closure validator.
- Dependency/technical-debt drift — use inventory-backed audit, not mass speculative cleanup.

## 6. Session handoff block

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
  evidence      = <fill>
  blocker       = <fill>
  nextAction    = <fill>
  remainingWork = <fill>
```

## 7. Agent start command

Start every session here:

`READ PROJECTS.md → READ AGENTS.md → INGEST HANDOFF → identify ACTIVE task → establish exact main SHA → inspect contract → execute → prove → update this file.`

## 8. Non-negotiable evidence rule

No task may be promoted to `CLOSED / STABLE` from a local result, stale CI run, branch-local result, partial matrix, cancelled job, or inferred behavior.

The release truth is always:

`EXACT SHA ∧ CLEAN WORKTREE ∧ REQUIRED TEST PASS ∧ FRESH CURRENT EVIDENCE`.
