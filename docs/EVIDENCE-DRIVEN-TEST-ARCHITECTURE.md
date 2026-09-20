# FLIXO Evidence-Driven Test Architecture

## Goal

Minimum Execution — Maximum Evidence.

The existing FLIXO certification system remains the authoritative release proof. This layer adds a deterministic Test Impact Graph so ordinary changes can receive the smallest safe verification scope without weakening release certification.

## Flow

```text
Changed Files
    ↓
Test Impact Graph
    ↓
UNIT / CONTRACT / E2E
    ↓
Single Build (when impact requires it)
    ↓
Evidence Reducer
    ↓
PASS / FAIL / BLOCKED
    ↓
Certification
```

## Safety rules

1. Unknown files force `full` impact.
2. Release mode always forces `full` impact.
3. Impact planning never changes the release certification contract by itself.
4. Evidence is bound to the exact execution SHA and the impact-map SHA.
5. The planner recommends commands; certification remains responsible for release-grade completeness.
6. No duplicate execution should be introduced merely to produce evidence.

## Current domains

- `admin` → server boundary and persistence contracts
- `i18n` → locale and localization contracts
- `routing` → router/route resolver contracts
- `tools` → tool/unit and browser-impact verification
- `seo` → SEO/indexing contracts
- `dependencies` → dependency/install/type/lint/unit verification
- `ci` → CI/protocol/coordination contracts
- `ui-runtime` → type/lint/unit/build verification

## Rollout

Phase 1: deterministic impact planning and evidence artifact.

Phase 2: consume the impact plan for PR fast feedback and skip unaffected expensive layers.

Phase 3: keep full browser matrix + certification for release or high-risk changes only, with explicit escalation rules.

The existing full certification path is intentionally preserved until Phase 2 proves that impact selection is complete and fail-closed.
