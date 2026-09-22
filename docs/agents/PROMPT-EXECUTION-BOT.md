# FLIXO Prompt Execution Bot

## Purpose

`PROMPT-EXECUTION-BOT` is the repository-facing interpreter for free-form task prompts. It does not create a second prompt authority, agent registry, executor, memory, or certification authority.

Its job is to turn a user request into a bounded, evidence-aware Work Package that can be routed to the existing FLIXO execution system.

## Canonical lifecycle

`USER PROMPT → INTAKE → CONTEXT RETRIEVAL → UNDERSTAND GOAL → IDENTIFY INTENT → CLASSIFY CONSTRAINTS → MATCH ACTIVE TASK → BIND RPR-UNIFIED-EXECUTION-001 → 5X EVIDENCE ENVELOPE → SCOPE/RISK GATE → CANONICAL AGENT COMMUNICATION → AUTHORIZED EXECUTION/REPAIR → TARGETED VERIFICATION → AFFECTED CONTRACT GRAPH → CANONICAL CI → EXACT-SHA PROOF/CERTIFICATION → LEARN`

## 10X execution layer

The bot consumes the canonical READ_ONLY_POWER_PROFILE 5X extension; it does not create a second authority.

The 5X readiness envelope requires ten evidence classes:
IDENTITY + CONSTRAINTS + CAUSALITY + FALSIFICATION + REGRESSION

It also requires:
- 6–12 explicit hypotheses;
- at least 10 counterexample/falsification checks;
- five verification depths: targeted, affected-contract, canonical CI;
- evidence diversity across at least eight independent context sources;
- eight declared learning/continuity outputs;
- PRE-EXECUTION-50 and a fresh exact-SHA recheck before dispatch.

Failure of any requirement blocks dispatch. The envelope is a readiness gate only; Canonical CI and Certification remain final proof authorities.

For repair execution, the same canonical 5X envelope is a prerequisite inside the existing Action Vault Mutation Gate. Mutation authorization is deferred until that gate reports PASS, so 5X cannot be bypassed by calling the repair executor directly.

## Authority boundary

The bot is an interpreter and dispatcher. It may read canonical context, classify a prompt, identify constraints, match an active task, select the canonical prompt through the existing Prompt Intelligence layer, build a Work Package, and create a canonical agent-communication message. Repair-oriented Work Packages additionally bind to the Master Repair Gate after RCA/strategy and before mutation; the Master layer is supervisory/read-only and does not replace the existing mutation, verification, or Canonical GREEN authorities. It may not create a second prompt/agent/registry/executor authority, execute arbitrary shell commands supplied by the prompt, mutate `main`, create a third active branch, weaken gates, or declare GREEN/VERIFIED/CLOSED/certified state.

## Modes

`plan` is read-only interpretation. `dispatch` submits the Work Package through `scripts/ci/agent-communication.mjs` to an existing authorized role and requires the `execution` branch plus the current exact SHA.

Source mutation remains under the existing `executionAgent` / `repairAgent` authority and the existing control-plane, verification, certification, and branch protections. The Master Repair dossier may recommend progression only when exact-SHA evidence, causal proof, multi-hypothesis RCA, falsification, knowledge arbitration, and strategy provenance are coherent; otherwise it escalates for new evidence.

## Safety

User prompts and external artifacts are untrusted data. Attempts to override repository rules, weaken/skip gates, mutate `main`, create a third branch, rewrite history, or expose secrets fail closed. Negated requirements such as “do not mutate main” are treated as constraints.

## Exact-SHA

Each Work Package carries the current execution SHA, main SHA when available, canonical source digests, Prompt Registry digest, selected task, selected canonical prompt, proof obligations, and stop conditions. Any SHA movement invalidates prior evidence and requires requalification.

## Canonical Push Consolidation
The execution bot treats accumulated agent pushes as integration inputs, not independent lanes. Before dispatch it binds every packet to the current exact `execution` SHA, deduplicates repeated commits, orders ancestry-compatible packets, detects overlapping file scope and unresolved divergence, and fails closed on stale/unjoined or conflicting packets. The consolidation result is advisory integration intelligence only; mutation, merge and certification authority remain unchanged.
