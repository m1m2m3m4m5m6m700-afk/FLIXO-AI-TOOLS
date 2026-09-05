# FLIXO Debt Register

## Current baseline — 2026-08-28

- Main SHA: `c81d6da7fcb8bf02334d11e3ce8254f19ef3e793`
- Production source of truth: `main`
- Open pull requests: `#435` (`feat(i18n): strict localization quality gate`)
- PR #436: merged into `main`
- Vercel status on current main SHA: `success` (deployment-provider evidence)
- Full Matrix Promotion on current main SHA: Run `33173614731` = `success` (23 suites × 3 browsers)
- Canonical GitHub CI certification for the current main SHA is not asserted unless a completed exact-SHA canonical run is independently present.
- Open consolidation issues: `#127`, `#133`, `#73`

This register is the active engineering debt inventory. Historical notes remain evidence only.

## Priority model

- **P0** — blocks trustworthy architecture, release truth, or safe change propagation.
- **P1** — materially increases complexity, duplication, maintenance risk, or release cost.
- **P2** — cleanup that improves coherence after P0/P1 work.

## Active debt

| ID | Area | Priority | Evidence | Risk | Action | Exit criterion | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D-001 | Current-state documentation | P0 | Previous baseline sections pointed to `91606c1`; current main is `c81d6da` | Engineers can act on stale state | Synchronize both governance documents with exact current SHA, PR, and evidence state | Current state is unambiguous and evidence-backed | **In progress** |
| D-002 | Release evidence observability | P0 | Current main has deployment and matrix evidence, but canonical CI certification is not independently asserted here | Release state can be misclassified | Keep CODE / DEPLOYMENT / MISSING-EVIDENCE states explicit | Every promotion decision is tied to exact-SHA evidence | Open |
| D-003 | Verification surface | P1 | Many public `validate:*`, `report:*`, and `test:*` commands exist beside `check`, `verify`, and E2E | Hidden coupling and duplicated checks increase CI complexity | Group checks by stable contract domain and retain small public entry points | One owner and one canonical entry point per check | Open |
| D-004 | Tool contract cohesion | P0 | Registry, manifest, router, SEO, sitemap, localization, QuickFlow, and E2E share tool metadata | Drift can reappear | Converge on one canonical `ToolDefinition` and derive consumers | A new tool is represented once | Planned |
| D-005 | Canonical origin | P1 | `SITE_ORIGIN` is hardcoded while architecture expects deployment-time `VITE_SITE_URL` | SEO/sitemap can point at the wrong origin | Define one validated runtime/build source for the production origin | No hardcoded deployment origin remains in canonical SEO generation | Planned |
| D-006 | Heavy dependency governance | P1 | Runtime manifest includes heavy/optional media, PDF, database, and mail packages | Initial-load and maintenance costs can grow | Inventory and classify core, lazy, server-only, removable, experimental | Optional heavy packages do not enter initial route without evidence | Open |
| D-007 | i18n ownership fragmentation | P1 | Multiple historical localized data surfaces coexist with canonical config/types/loader | Translation ownership can drift | Audit and converge owners | One clear owner per translation concern | Open |
| D-008 | Artifact contract cohesion | P1 | Output integrity exists but is spread across validators/tests | UI can pass while output contract is wrong | Standardize MIME/signature/binary/download contracts | Every file-producing tool declares and proves its artifact contract | Planned |
| D-009 | Shared browser harness | P1 | Full matrix and tool contracts both carry tool lifecycle checks | Test logic multiplies as tools grow | Introduce reusable lifecycle/input/output/error/a11y harness | Common checks are reused across tools | Planned |
| D-010 | Branch hygiene | P2 | Hundreds of historical/final/tmp/self-heal branches remain | Historical noise can be mistaken for release truth | Triage, archive, or delete only after evidence review | Active branches are few and intentional | Open |
| D-011 | Issue hygiene | P2 | Open issues include `#133` (`ignore`) plus legacy roadmap items | Task queue contains noise and stale intent | Close/archive obsolete items; preserve useful roadmap work | Every open issue has purpose and next action | Open |
| D-012 | Release artifacts | P2 | Repository has no GitHub Releases yet | No immutable public release checkpoint | Introduce `v1.0.0` only after full certification | Tag + release + exact-SHA evidence linked | Planned |

## Execution order

```text
D-001 / D-002
      ↓
PR #435 strict i18n gate
      ↓
D-004 ToolDefinition + Registry SSOT
      ↓
D-005 canonical origin
      ↓
D-003 verification consolidation
      ↓
D-007 i18n ownership cleanup
      ↓
D-006 dependency governance
      ↓
D-008 artifact contracts
      ↓
D-009 shared E2E harness
      ↓
D-010 / D-011 branch + issue hygiene
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
