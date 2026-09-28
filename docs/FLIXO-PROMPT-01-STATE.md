# FLIXO Prompt 01 — Exact-SHA State Reconciliation

STATUS: **BLOCKER**
PROMPT_ID: **01**
START_SHA: `9debe1a4bc82fdc404163e1b43cf95aeb9596981`
END_SHA: **PENDING — documentation-only state record**
MUTATED: **true (documentation only)**
NEXT_PROMPT: **01 re-verification after blocker resolution**

## Exact lineage

- CURRENT_MAIN_SHA: `8a4bb5b8772791dfb718850519c51eb2cfe801af`
- CURRENT_EXECUTION_SHA: `9debe1a4bc82fdc404163e1b43cf95aeb9596981`
- ACTIVE_INTEGRATION_PR: #889
- PR_BASE_SHA: `8a4bb5b8772791dfb718850519c51eb2cfe801af`
- PR_HEAD_SHA: `9debe1a4bc82fdc404163e1b43cf95aeb9596981`

## Current required-check evidence

The current execution head does **not** have a green verification set.

Observed failures on the current PR/head lineage:

- FLIXO CI run `36380710714`: **FAILURE**
  - `npm test`: FAILURE
  - `trust-gate`: FAILURE
  - `Exact-SHA promotion proof`: FAILURE
  - Chromium browser smoke: SKIPPED because an earlier gate failed.
- Agent Editor Step 5-6 Verification run `36380710669`: **FAILURE**
  - Type-check: FAILURE
- FLIXO Agent Editor STEP 4 run `36380710792`: **FAILURE**
  - STEP 4 verification gate: FAILURE
- Agent Editor Coverage run `36380710716`: **FAILURE**
  - Codecov upload: FAILURE

Commit status for `9debe1a4bc82fdc404163e1b43cf95aeb9596981` is **pending** with zero reported statuses at the legacy status endpoint; workflow-run evidence above is the authoritative observed CI evidence for this reconciliation.

## Stale evidence invalidated

The PR description currently contains an older claimed execution head `fd2de9387b00586613bc6592cf8662e5eb666786` and claims PASS for several checks. That SHA is not the current PR head. Those claims are therefore **STALE** and cannot certify `9debe1a4bc82fdc404163e1b43cf95aeb9596981`.

The reported local SHA `c896b8060c2dd03680e149eb97cee2d9b70d38c2` was not found in the connected remote repository. It remains unverified remote evidence.

## Blockers

1. The current exact execution SHA has failing required/verification workflows.
2. Exact-SHA promotion proof is failing on the current head.
3. Agent Editor type-check/verification is failing on the current lineage.
4. The current evidence set does not establish certification or release readiness.
5. Prompt 02 is not authorized to start until Prompt 01 is re-verified on an exact candidate SHA after these blockers are resolved.

## Decision

**FAIL CLOSED.**

Do not declare GREEN, PASS, VERIFIED, CERTIFIED, RELEASE VERIFIED, or production-ready from the current state.

The next allowed action is to repair only the blockers above, then re-run Prompt 01 against the resulting exact SHA.
