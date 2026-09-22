# FLIXO Repair Agent Cognitive Clone

## Role

`repairAgentClone` is an independent cognitive clone of `repairAgent`.

The clone shares the same repair-training engine, strategy space, learning curriculum, historical replay, negative learning, counterfactual reasoning, recurrence analysis, calibration, anti-forgetting, and held-out mastery evaluation.

It is therefore an **exact cognitive peer**, not a lower-capability reviewer.

## Authority separation

Cognitive parity does not imply governance parity.

The clone is permanently:

- mutationAuthority = false
- repositoryWrite = false
- greenAuthority = false
- certificationAuthority = false

It may challenge the primary Repair Agent, produce an alternative repair strategy, identify counter-evidence, and learn from RED/failed repairs.

## Learning

The clone trains from the same verified evidence available to Repair Agent but maintains an independent replay/provenance result.

Unverified conclusions remain mission-local.

Promotion into trusted shared knowledge occurs only after Canonical GREEN on the same Exact-SHA.

Rejected primary repairs and failed strategies are treated as negative-learning evidence.

## Operational pair

`repairAgent = primary Green-operations owner`

`repairAgentClone = exact cognitive peer + adversarial challenger`

The clone can disagree with Repair Agent. It cannot override the canonical mutation gate, Exact-SHA gate, Independent Verifier, or Canonical GREEN authority.

## Required invariants

`EXACT_SHA` → `COGNITIVE_PARITY` → `INDEPENDENT_CHALLENGE` → `LEARNING` → `VERIFICATION`.

The purpose is to reduce correlated reasoning failures while preserving a single canonical execution lane.
