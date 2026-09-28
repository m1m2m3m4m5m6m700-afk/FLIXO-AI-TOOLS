# FLIXO — Autonomy, Resilience & Model Independence Implementation Plan

## Status

Implementation lane: `execution`. Production truth remains `main`. This document is a plan and control contract; it does not certify production readiness.

## Target architecture

User → FLIXO_AGENT → task classification → admitted Model Fabric → canonical ToolPlan → structural validation → parameter/value validation → semantic intent validation → canonical Capability Registry → local browser Executor → mandatory Verifier → recovery/manual fallback → final response.

The model is a replaceable proposal resource. Planner contracts must not depend on a provider SDK. Executors must not select models. Verifiers must independently determine whether the artifact satisfies the declared output contract.

## Model independence

1. The canonical model manifest is the admission authority.
2. A model is usable only when its license/provenance/policy/evaluation gates are PASS and lifecycle is ACTIVE.
3. UNKNOWN, REVIEW_REQUIRED, BLOCKED and QUARANTINED models are fail-closed.
4. Runtime model selection comes from the admitted Model Fabric, not an arbitrary environment model.
5. Provider/model failover uses a bounded candidate list and a circuit breaker.
6. If no admitted hosted candidate is available, the deterministic planner is used.
7. Every fallback preserves the same canonical ToolPlan, Executor and Verifier contracts.
8. No model/provider may become a hidden second tool registry.

## ToolPlan validation

Every model-produced plan passes three independent gates:

- Structural: schema, step count, required fields, canonical catalog fingerprint.
- Values: canonical parameter schema, ranges, enums, resource limits.
- Semantic: requested intent must match every selected executable capability.

A rejected plan never reaches an Executor.

## Execution safety

- Capability state and execution mode come only from the canonical capability registry.
- MVP file processing remains browser-local/browser-worker and network-free.
- Output success requires the capability verifier.
- A tool completion signal is not sufficient evidence that the user task succeeded.
- Retry is bounded; `replanOnFailure=false` remains the MVP rule.
- State-changing operations use stable idempotency identity where applicable.

## Resilience

Primary → admitted candidate 2 → admitted candidate 3 → deterministic local plan.

Circuit breaker policy:
- bounded failure threshold;
- cooldown before re-entry;
- no retry loops;
- no automatic admission or promotion;
- success closes the provider circuit;
- repeated failures open the circuit.

## Observability

Trace stages are:

`request → intent → model → plan → tool → verification → fallback/recovery → final`.

Trace metadata is allowlisted. User file bytes, secrets, prompts containing credentials, and raw artifacts are not trace payloads.

## Memory integrity

Memory is context, not authority. Future implementation must retain source, confidence, verification status, execution identity and artifact identity. Unverified execution outcomes must not become authoritative lessons or routing facts.

## Red-team matrix

The implementation is incomplete until tests cover:

1. direct specialist injection;
2. unregistered model;
3. invalid model hash;
4. license/policy quarantine;
5. provider outage;
6. circuit opening;
7. all admitted providers unavailable;
8. malformed ToolPlan;
9. invalid parameter values;
10. semantic mismatch;
11. non-executable capability;
12. verifier failure;
13. browser/network boundary violation;
14. duplicate state-changing request;
15. unverified memory contamination;
16. stale exact-SHA evidence.

## Acceptance evidence

Each gate requires an evidence ID tied to the exact candidate SHA and, where applicable, a CI run/job ID. Missing evidence is PENDING, never PASS.

## Integration rule

Workflow changes remain behind `[REQUIRES HUMAN REVIEW]`. No direct `main` writes. No merge is implied by this plan.
