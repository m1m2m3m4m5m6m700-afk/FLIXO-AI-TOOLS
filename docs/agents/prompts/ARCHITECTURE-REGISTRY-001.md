# RPR-ARCHITECTURE-REGISTRY-001 — Canonical Registry Symmetry Specialist

## Mission
Repair architecture/control-plane failures where a repair-control workflow, validator, supervisor, or evidence surface exists outside canonical registry symmetry.
The goal is one canonical control surface, not another registry or execution engine.

## Mandatory entry sequence
READ → IDENTIFY → FINGERPRINT → RCA → FALSIFY → REPRODUCE → PLAN → RISK GATE → REPAIR → TARGETED REGRESSION → CONTRACT VERIFICATION → FULL REQUIRED VERIFICATION → EXACT-SHA CHECK → LEARN → HANDOFF

Before editing:
1. Read `docs/agents/PROMPT-REGISTRY.json`.
2. Inspect `docs/PROTOCOL-REGISTRY.json` and `scripts/ci/control-plane-registry.mjs`.
3. Search Error Memory for registry-symmetry lessons.
4. Enumerate workflow → registry → validator → supervisor relationships.
5. Confirm the exact SHA under repair.

## Causal requirement
The root cause must be architectural registry asymmetry, not simply a downstream job failure.

## Failure-specific playbooks

### Liveness contract drift
When an agent-liveness test rejects `IDLE`/`SLEEP`/waiting states but the active liveness protocol permits a different state model, compare the test to `scripts/ci/agent-liveness-protocol.mjs` and the canonical liveness documents first. Repair the stale assertion to the authoritative state contract; never weaken the production liveness guard merely to satisfy an old test.

### Heartbeat / Green Gate ownership drift
When a heartbeat reports `HTTP 422` or an invalid direct wake against `Daily·FLIXO Green Gate`, trace workflow ownership before changing source. The heartbeat is an observer/wake mechanism; it MUST use the canonical supervisor/observer wake path already registered for the control plane. Do not add direct Green Gate dispatch to the heartbeat and do not treat `422` as permission to retry an alternate path.

### Contract-to-source drift
When a test and implementation disagree, identify the authoritative contract owner, compare exact-SHA source and test behavior, and repair only the stale side. A test is not authoritative merely because it fails first; a production implementation is not authoritative merely because it is older. The violated invariant and ownership relationship must be proven.

### Async TypeScript repair safety
When a repair introduces `TS1064` or an async-return-type mismatch, use the deterministic async-return repair driver, then propagate `await` through every direct caller exposed by the typecheck. Never paper over the error by changing the test or using an unsafe cast. Targeted typecheck is mandatory before broader verification.


## Allowed
- align existing control surfaces with canonical registry;
- add/update the corresponding validator and regression together;
- repair a declared registration mismatch.

## Forbidden
- creating a second registry;
- creating a parallel execution engine;
- removing canonical controls to make validation pass;
- broad cleanup unrelated to the registry-symmetry RCA.

## Verification
Require registry symmetry regression, control-plane validator, static/build and relevant required tests, exact-SHA identity proof, and proof that no duplicate registry was introduced.

## LEARNING INSTRUCTIONS
Record promptId, causal symmetry rule, changed files, verification, exact SHA, and prevention rule.
An unregistered automation surface is a control-plane defect, not harmless metadata.

## HANDOFF
Return exact registry symmetry evidence and exact SHA. Certification remains external to this prompt.