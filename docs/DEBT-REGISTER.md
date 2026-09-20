# FLIXO Debt Register

## Verification Baseline — 2026-09-12

- Last verified SHA: `b79a86d2d258fdbe7e936c4c32f277d72a00260e`
- Verification checkpoint: `PR #633 merge checkpoint — b79a86d2d258fdbe7e936c4c32f277d72a00260e`
- Verification result: PASS
- Observed branch: main
- Current execution SHA is derived from CI runtime identity and is not stored as a self-referential documentation invariant.
- The verification baseline is a historical checkpoint and may differ from the commit containing this document.

- Production source of truth: `main`
- Verified baseline capability: CI/CD Trust Layer was merged through PR #633 at the verification baseline above.
- PR #627 (`refactor(i18n): remove global runtime translation from startup`) is **MERGED** at `56e3df36b1d8d8790234e90e395522c7582d51e6`.
- Vercel status on the current `main` SHA is deployment-provider evidence only.
- Release certification is always required on the exact merge SHA; PR/FAST evidence alone is not release certification.
- FIX-001 — Branch Protection is `BLOCKED_EXTERNAL / OPEN`; it requires GitHub branch-protection permissions that were unavailable to the automation integration.

This register is the active engineering debt inventory. Historical notes remain evidence only and must not be treated as current state.

## Priority model

- **P0** — blocks trustworthy architecture, release truth, or safe change propagation.
- **P1** — materially increases complexity, duplication, maintenance risk, or release cost.
- **P2** — cleanup that improves coherence after P0/P1 work.

## Active debt

| ID | Area | Priority | Evidence | Risk | Action | Exit criterion | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D-001 | Current-state documentation | P0 | Verification baseline is explicitly recorded at a historical verified checkpoint; current branch-head is not duplicated into versioned documentation | Engineers can still act on stale state if verification evidence is unclear | Keep verification checkpoint and state classification explicit | Current state is unambiguous and evidence-backed | **In progress** |
| D-002 | Release evidence observability | P0 | Main verification baseline and CI/CD trust controls are tracked separately from current execution identity | Release state can be misclassified | Keep CODE / DEPLOYMENT / MISSING-EVIDENCE states explicit | Every promotion decision is tied to exact-SHA evidence | Open |
| D-003 | Verification surface | P1 | Many public `validate:*`, `report:*`, and `test:*` commands coexist with `check`, `verify`, and E2E | Hidden coupling and duplicated checks increase CI complexity | Group checks by stable contract domain and retain small public entry points | One owner and one canonical entry point per check | Open |
| D-004 | Tool contract cohesion | P0 | Registry, manifest, router, SEO, sitemap, localization, QuickFlow, and E2E share tool metadata | Drift can reappear | Converge on one canonical `ToolDefinition` and derive consumers | A new tool is represented once | Planned |
| D-005 | Canonical origin | P1 | Production origin is centrally validated; deployment remains tied to the official origin contract | Domain migration requires architectural/configuration change | Keep one validated runtime/build source for production origin | No conflicting canonical deployment origin | Planned |
| D-006 | Heavy dependency governance | P1 | Optional/heavy capability dependencies exist alongside lightweight browser tools | Initial-load and maintenance costs can grow | Inventory and classify core, lazy, server-only, removable, experimental | Optional heavy packages do not enter initial route without evidence | Open |
| D-007 | i18n ownership fragmentation | P1 | Historical localized data surfaces coexist with canonical config/types/loader and compatibility modules; startup no longer installs global DOM translation | Translation ownership can drift | Replace remaining legacy DOM rewrite modules with React-owned localized data and one generated source | One clear owner per translation concern | **In progress** |
| D-008 | Artifact contract cohesion | P1 | Output integrity exists but is distributed across validators/tests | UI can pass while output contract is wrong | Standardize MIME/signature/binary/download/semantic contracts | Every file-producing tool declares and proves its artifact contract | Planned |
| D-009 | Shared browser harness | P1 | Full matrix and tool contracts carry repeated lifecycle checks | Test logic multiplies as tools grow | Introduce reusable lifecycle/input/output/error/a11y harness | Common checks are reused across tools | Planned |
| D-010 | Branch hygiene | P2 | Historical repair/audit branches remain | Historical noise can be mistaken for release truth | Triage and archive/delete only after evidence review | Active branches are few and intentional | Open |
| D-011 | Issue hygiene | P2 | Legacy issue inventory remains | Task queue contains noise and stale intent | Close/archive obsolete items; preserve useful roadmap work | Every open issue has purpose and next action | Open |
| D-012 | Release artifacts | P2 | Repository has no immutable GitHub Release checkpoint | Public release state lacks a versioned checkpoint | Introduce `v1.0.0` only after full certification | Tag + release + exact-SHA evidence linked | Planned |
| FIX-001 | Branch protection | P0 | GitHub branch-protection mutation returned `403 Resource not accessible by integration` | `main` protection and required checks cannot be enforced by current automation permissions | Apply branch protection with an authorized GitHub account/integration and verify `protected:true` plus required checks | **BLOCKED_EXTERNAL / OPEN** |

## Current execution order

```text
D-001 / D-002
      ↓
Verification baseline @ b79a86d…
      ↓
PATCH-D / FIX-002 documentation synchronization
      ↓
B1/B2/B3 i18n runtime remediation history / follow-up hardening
      ↓
D-004 ToolDefinition + Registry SSOT
      ↓
D-008 artifact semantic verification
      ↓
D-005 endpoint/security hardening
      ↓
D-009 shared E2E harness
      ↓
D-003 verification consolidation / CI impact graph
      ↓
D-006 dependency governance
      ↓
D-010 / D-011 branch + issue hygiene
      ↓
FIX-001 when external branch-protection permission is available
      ↓
D-012 release v1.0.0
```

## Rules

1. No direct development changes to `main`.
2. One coherent debt cluster per PR.
3. No unrelated dependency upgrades inside consolidation work.
4. No historical deletion merely for cleanliness.
5. No release certification without fresh exact-SHA evidence.
6. A cleanup is complete only when its exit criterion is demonstrable by code or CI evidence.
7. A new duplicate source of truth is a regression and must be rejected.
8. Unmerged work is always `UNVERIFIED` until exact-SHA gates pass.
9. `Last verified SHA` is a verification checkpoint, not the SHA of the commit containing this document.
10. `Current main SHA` is an execution-time fact and must not be encoded as a self-referential static invariant.
