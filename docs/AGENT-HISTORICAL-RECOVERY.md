# Agent Historical Recovery

## Purpose

This document records the first controlled recovery pass for the FLIXO agent architecture. Historical code is not copied blindly; each recovered contract is compared with `main` and classified before use.

## Baseline

- Historical comparison commit: `1ff1baefd1d4a1dbe7514e3ca648e6aa4ae243ae`
- Current branch: `main`
- Current execution pipeline was found to already contain capability-aware verification, bounded retries, stable-input recovery, and a verification error contract.
- Current QuickFlow was found to already contain structured parameter extraction, executable capability gating, parameter validation, duplicate-operation protection, and a four-step bound.
- Current canonical tool definition already contains capability state, execution mode, parameter schemas, safety limits, and output verifiers.

## Recovery matrix

| Historical area | Historical evidence | Current state | Classification | Action |
|---|---|---|---|---|
| QuickFlow | `src/lib/quickflow.ts` at baseline commit | Present on `main` | KEEP-LEGACY/ADAPT | Reuse current implementation; do not copy historical file wholesale. |
| Structured parameter extraction | `src/lib/agent/intent/parameter-extractor.ts` referenced by historical QuickFlow and planner tests | Present on `main` | KEEP-LEGACY/ADAPT | Treat current extractor as canonical and add coverage before behavioral changes. |
| Capability registry | `src/lib/agent/capability-registry.ts` | Present on `main`, derived from canonical definitions | MERGE | Remove duplicated capability type declarations and make canonical definitions the type source. |
| Canonical ToolDefinition | `src/config/canonical-tool-definition.ts` | Present on `main` | KEEP-LEGACY/ADAPT | Preserve as source of truth for tool/capability metadata. |
| Pipeline verification | `src/lib/workflows/pipeline-runner.ts` | Present on `main` and materially matches historical verified pipeline | KEEP-LEGACY | Do not restore a duplicate implementation. |
| Bounded retry/repair | `pipeline-runner.ts` historical implementation | Present on `main` | KEEP-LEGACY | Preserve bounded retry semantics; later add explicit agent-level replanning separately. |
| Conversational confirmation/task state | No current equivalent established by this recovery pass | Not yet established | RESTORE/ADAPT candidate | Requires a dedicated state/contract implementation in the next phases; no historical file is copied yet. |
| Agent self-correction/memory | Historical concepts referenced in project history, but no authoritative current contract identified in this pass | Not established as a single current contract | RESTORE/ADAPT candidate | Recover only after locating exact historical contract and tests. |

## First implementation result

The first safe implementation change is the capability-contract consolidation:

- `src/config/canonical-tool-definition.ts` remains the source of truth.
- `src/lib/agent/capability-registry.ts` now derives its public types from the canonical definition instead of redefining the same capability types.
- Planner/executor consumers continue to use the registry boundary.
- No historical pipeline implementation was duplicated.

Implementation commit: `1d549e3df3228e16a418258ce4108447c390e931`.

## Safety decision

The historical pipeline verifier is considered already integrated on `main`; restoring it again would create duplicate behavior and increase drift risk. The next work should therefore focus on the missing interactive layer: explicit task state, missing-information questions, plan presentation, confirmation/cancellation, and continuation state, while keeping Tool/Capability Registry as the execution authority.

## DO-NOT-RESTORE
Historical implementations must not be copied wholesale into `main`. Recovery is limited to evidence-backed RESTORE/ADAPT or MERGE decisions after exact comparison, contract review, and verification planning.
