# FLIXO — Model License Resilience & Sustainability Execution Plan

Status: ACTIVE / Phase 0 started
Branch: execution
Base SHA: 4b40f6906a7ce0a2551f8aacf5105e68397a349f
Authority: FLIXO Control Plane
Rule: no direct writes to main; no automatic model promotion; remote/desktop execution is reserved for tasks that genuinely require a local environment or browser/device state.

## Objective

Make FLIXO resilient to model-license changes, upstream withdrawal, policy changes, source disappearance, security incidents, or model replacement without making the FLIXO Agent Runtime dependent on one third-party model.

The target architecture is:

Open Base -> FLIXO Adapter -> FLIXO Specialized Model -> FLIXO Proprietary Model

while keeping FLIXO-owned runtime assets independent:

Router -> Planner -> Tool Registry -> Executor -> Verifier -> Memory -> Safety Gates -> Evaluation

## Non-negotiable principles

1. A third-party base model is never represented as FLIXO-owned merely because FLIXO fine-tunes it.
2. Every model entering the registry must have versioned provenance, immutable artifact identity where available, license evidence, policy evidence, and an exit/fallback strategy.
3. Production references are pinned to an exact model release/artifact, never "latest".
4. Model selection is an adapter concern. FLIXO ToolPlan, execution, verification, safety, and output contracts remain model-independent.
5. A license/policy failure quarantines the affected model; it must not automatically disable FLIXO.
6. Fallback activation must preserve the canonical ToolPlan contract and pass the same evaluation gates.
7. Training-data provenance is a separate gate from model-license status.
8. Trademark, patent, acceptable-use, hosting, and redistribution restrictions are tracked separately from copyright license.
9. Old evidence cannot certify a newer model artifact or repository SHA.
10. No model becomes ACTIVE/PRODUCTION through self-promotion or automated registry mutation.

## Implementation phases

### Phase 0 — Record the architecture and inventory
- Keep this plan as the durable execution source for this work.
- Establish MODEL_LICENSE_MANIFEST and model registry metadata.
- Record current candidate models only as CANDIDATE until evidence is complete.
- Define approved/review-required/prohibited license classes.
- Add provenance fields for model, weights, adapter, dataset, and policy snapshots.

Exit condition: every candidate has an explicit compliance state; missing evidence is never treated as PASS.

### Phase 1 — License + provenance gates
Implement deterministic gates that validate:
- license identifier and license evidence;
- source/repository and exact revision;
- artifact checksum when available;
- usage/acceptable-use policy evidence;
- redistribution/fine-tuning/distillation status;
- trademark restrictions;
- training-data restrictions/provenance;
- FLIXO-owned layer declaration;
- human/legal-review requirement where automated classification is insufficient.

Gate result must be one of:
PASS / REVIEW_REQUIRED / BLOCKED / UNKNOWN.

UNKNOWN is not production-safe.

### Phase 2 — Model abstraction
Create/verify a single Model Adapter contract:
- normalized generation/planning interface;
- structured ToolPlan output;
- provider/model-specific code isolated behind the adapter;
- no raw File/Blob bytes sent to planning providers;
- deterministic validation before execution.

Do not create a second registry or second authority system.

### Phase 3 — Fallback and exit strategy
For every production model:
- define at least one compatible fallback;
- pin fallback versions;
- run ToolPlan compatibility tests;
- run Arabic and image-editing intent regression tests;
- verify failure-closed behavior;
- test model quarantine and fallback activation.

A model with no tested exit path cannot be the sole production dependency for critical agent behavior.

### Phase 4 — FLIXO data and adapter ownership
Separate:
- third-party base weights;
- FLIXO-created datasets;
- third-party datasets;
- FLIXO adapters/LoRA;
- generated evaluation corpus;
- runtime/policy code.

For each asset, retain provenance and applicable license terms. Ownership claims remain subject to the upstream model terms and applicable law.

### Phase 5 — Proprietary-model runway
Build toward:
Open Base -> FLIXO Adapter -> FLIXO Specialized Model -> FLIXO Proprietary Model.

The proprietary-model phase must use data and evaluation assets whose provenance permits the intended training and distribution. No contaminated or unclear training source is silently included.

### Phase 6 — CI / release enforcement
Add CI checks so that:
- unregistered models fail the gate;
- missing license/provenance evidence fails the gate;
- changed model version requires fresh evaluation;
- changed model policy requires review;
- blocked/quarantined models cannot be production-selected;
- fallback compatibility is tested;
- model changes are bound to exact commit/model artifact evidence.

## Model lifecycle

CANDIDATE -> REVIEW -> APPROVED -> ACTIVE

Any of:
license conflict
policy conflict
provenance failure
security incident
artifact mismatch
source withdrawal
unknown redistribution terms

must support:

ACTIVE -> QUARANTINED -> REPLACED/REVIEWED

Never:
ACTIVE -> automatically replaced without compatibility evaluation.

## Failure scenarios and required response

1. Upstream changes the license for future releases:
   keep already-approved pinned artifacts isolated; review future releases independently.

2. Upstream source disappears:
   retain provenance/evidence for artifacts lawfully acquired; activate tested fallback where appropriate; do not fetch an unverified replacement.

3. Acceptable-use policy changes:
   re-evaluate affected use cases before continued production use.

4. Model artifact changes without version change:
   checksum/provenance mismatch => BLOCKED until reviewed.

5. Security vulnerability:
   QUARANTINE affected model and execute the tested fallback path.

6. Fine-tune/LoRA terms are unclear:
   REVIEW_REQUIRED; do not label the adapter proprietary/exclusive automatically.

7. Training data provenance is unclear:
   BLOCKED for proprietary-model training until resolved.

## Remote/compute budget rule

Default work mode:
- repository inspection/editing through the connected GitHub interface;
- local deterministic scripts/tests when the environment is available;
- no Desktop Commander/remote execution for ordinary file edits, registry work, documentation, or GitHub operations.

Remote execution is reserved for:
- browser/device verification requiring the user's environment;
- local-only build/runtime failures that cannot be reproduced through repository/CI evidence;
- heavyweight or environment-specific diagnostics;
- tasks explicitly requiring a local credentialed resource.

Never spend remote budget merely to inspect or edit text that can be handled through GitHub.

## Acceptance criteria

This initiative is complete only when:
- every production model has a complete manifest;
- license/provenance/policy gates are deterministic;
- no unregistered model can become ACTIVE;
- model adapters isolate provider-specific behavior;
- at least one tested fallback exists for each critical production model;
- quarantine/fallback behavior is tested;
- model changes trigger fresh evaluation;
- FLIXO runtime remains operational when the primary model is removed;
- exact model artifact + exact repository SHA are recorded in evidence.

## Current execution checkpoint

Started on execution at 4b40f6906a7ce0a2551f8aacf5105e68397a349f.
Initial durable artifacts are being added in the same commit:
- docs/MODEL-SUSTAINABILITY-PLAN.md
- docs/MODEL_LICENSE_MANIFEST.json
- docs/MODEL-LICENSE-POLICY.json

Next implementation step: inspect existing model/provider adapters and registries, then integrate the manifest/gates without creating a parallel runtime authority.
