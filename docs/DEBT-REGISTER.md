# FLIXO Debt Register

## Current baseline

- Date: 2026-08-28
- Main baseline SHA: `91606c19119ee62e4be8c23c2381568ac71b83ae`
- Open pull requests at baseline inspection: `0`
- Visible commit status: `Vercel = success`
- GitHub Actions runs returned for this exact SHA: none through the available workflow-run query
- Production source of truth: `main`

This register is the active engineering debt inventory. Historical consolidation notes remain historical evidence and must not be treated as current state.

## Priority model

- **P0** — blocks trustworthy architecture, release truth, or safe change propagation.
- **P1** — materially increases complexity, duplication, maintenance risk, or release cost.
- **P2** — cleanup that improves coherence after P0/P1 work.

## Active debt

| ID | Area | Priority | Evidence | Risk | Action | Exit criterion | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D-001 | Current-state documentation | P0 | `docs/CONSOLIDATION-LOG.md` starts with a 2026-08-23 baseline while `main` is now at `91606c1` | Engineers can act on stale state | Add a current-state section and keep older entries explicitly historical | Current baseline, CI evidence, and open-PR state are unambiguous | In progress |
| D-002 | Release evidence observability | P0 | The exact `91606c1` status exposed through the available GitHub query is Vercel only; no workflow run was returned | A single provider status cannot certify repository/browser gates | Preserve exact-SHA evidence classification and verify required Actions evidence before certification | Release decision can distinguish CODE, DEPLOYMENT, and missing-evidence states | Open |
| D-003 | Verification surface | P1 | `package.json` exposes many independent `validate:*`, `report:*`, and `test:*` scripts in addition to `check`, `verify`, and E2E | Hidden coupling and duplicated checks increase CI complexity | Group checks by stable contract domain and keep only a small public command surface | Every check has one owner, one purpose, and one canonical entry point | Open |
| D-004 | Tool contract cohesion | P0 | Tool registry, manifest, router, SEO, sitemap, localization, QuickFlow, and E2E all depend on related tool metadata | Drift can reappear when a new tool requires edits in multiple sources | Introduce one canonical `ToolDefinition` contract, then derive consumers incrementally | A new tool can be represented once and consumers are derived from that definition | Planned |
| D-005 | Heavy dependency governance | P1 | Runtime manifest contains heavy/optional packages such as FFmpeg, PDF stacks, database, mail, and media tooling | Unnecessary initial-load cost and dependency maintenance burden | Inventory usage and classify dependencies as core, lazy, server-only, removable, or experimental | No optional heavy dependency is part of the initial route without explicit evidence | Open |
| D-006 | i18n surface fragmentation | P1 | Historical consolidation records multiple localized data surfaces (`home-*`, `quickflow-*`, and `tool-ui-*`) plus the canonical i18n loader | Duplicate ownership can create translation drift and awkward migration paths | Audit the current owners, then converge on config/types/loader plus derived feature data | One clear owner per translation concern and no parallel runtime loaders | Open |
| D-007 | Historical work hygiene | P2 | Current open issues include #127, #73, and #133 while older consolidation records refer to obsolete PR states | Stale work creates decision noise and accidental resurrection of legacy assumptions | Triage each item as active, rebuild, archive, or close | No issue remains without a current purpose and next action | Open |
| D-008 | Tool test duplication | P1 | Browser verification is broad and independent, while tool contracts are separately tested | Adding tools can multiply custom test logic | Build a shared tool test harness around stable contracts | Common lifecycle/input/output/error/accessibility checks are reusable across tools | Planned |
| D-009 | Artifact contract cohesion | P1 | Output integrity is already tested but the platform still benefits from a single output contract spanning MIME/signature/binary/download behavior | A tool can pass UI checks while producing a wrong artifact | Standardize artifact validators and tool output contracts | Every file-producing tool declares and proves its output contract | Planned |

## Execution order

```text
D-001 / D-002
      ↓
D-004 ToolDefinition + Registry SSOT
      ↓
D-003 Verification consolidation
      ↓
D-006 i18n ownership cleanup
      ↓
D-005 Dependency governance
      ↓
D-009 Artifact contracts
      ↓
D-008 Shared E2E harness
      ↓
D-007 Historical issue/branch cleanup
```

## Rules

1. No direct development changes to `main`.
2. One coherent debt cluster per PR.
3. No unrelated dependency upgrades inside consolidation work.
4. No historical deletion merely for cleanliness.
5. No release certification without fresh evidence for the exact promoted SHA.
6. A cleanup is complete only when its exit criterion is demonstrable by code or CI evidence.
7. A new duplicate source of truth is a regression and must be rejected.
