# Common Engineering Contract

This document is the shared engineering contract between `FLIX.ART` and `FLIXO-AI-TOOLS`. It standardizes principles and verification semantics without requiring either repository to share its product runtime.

## 1. Golden Registry

Each project MUST maintain one authoritative registry for public tools/capabilities. A registry entry SHOULD define, in one place:

- stable identifier and aliases;
- canonical route/path when applicable;
- explicit readiness (`isReady`) and, when not ready, `reasonNotReady`;
- input/output contract;
- safety constraints;
- performance expectations or budget where applicable;
- verification ownership.

Production surfaces MUST derive from the authoritative registry rather than maintaining independent lists that can drift.

## 2. Strict Contracts

Tool boundaries MUST fail closed when required contracts are violated.

- **G2 / input safety:** validate declared type/extension, MIME where relevant, size, dimensions, filename/path constraints, and content signature/magic bytes where applicable before unsafe consumers process data.
- **G3 / output integrity:** validate existence, declared type/format, signature, byte integrity, expected filename, and other tool-specific output invariants before an output is presented as successful.
- Contract failures MUST remain visible; tests MUST NOT be removed, skipped, weakened, or masked to obtain green CI.

## 3. Deterministic Core

The core product path MUST remain deterministic and usable without an AI provider unless the feature is explicitly classified as AI-dependent.

AI is an optional enhancement layer where practical. Provider failure, missing credentials, or model unavailability MUST NOT break unrelated deterministic functionality.

## 4. Progressive Verification

Verification SHOULD proceed from cheap structural checks to expensive release checks:

1. `verify:tools` — authoritative registry and readiness invariants.
2. `verify:fast` — type/lint plus impact-aware contract verification.
3. `verify:contracts` — complete applicable contracts and deterministic evidence checks.
4. `release-check` — release-grade verification including E2E, evidence, and exact-SHA identity.

Repositories MAY keep project-specific command names internally, but these semantic stages MUST remain identifiable and documented.

## 5. Early Green Gate

A new commit MUST NOT be treated as a valid continuation of a change until the required early verification for its actual parent/head relationship has passed.

The gate MUST bind evidence to the exact tested commit SHA. Historical CI, a different branch head, or a merely similar commit is not evidence for the current change.

The workflow MUST fail closed when the expected SHA cannot be established or when evidence is missing, stale, or contradictory.

## 6. Root Cause First

Every persistent deterministic failure MUST be classified and tied to a root cause before the work advances.

A failure is not resolved merely because a later command happens to pass. The repair MUST address the originating contract violation and retain verifiable evidence of the repair.

## 7. Evidence and Exact Identity

Release evidence SHOULD record at minimum:

- repository and branch;
- exact commit SHA;
- parent SHA where relevant;
- contract/check name and version;
- expected result;
- actual result;
- assertion or command used;
- artifact/evidence reference;
- timestamp;
- root-cause identifier when applicable.

No green claim may depend on stale, partial, masked, or cross-SHA evidence.

## 8. Change Discipline

Changes MUST be justified by one of:

- a demonstrated user/product need;
- a proven defect or contract violation;
- measurable performance/reliability/security debt;
- a required compatibility or platform constraint.

Do not add tools, dependencies, abstractions, or CI complexity merely because they are available.

## 9. Performance

Performance tests are regression guards unless explicitly designed as user-facing SLO measurements. A budget is a failure threshold, not a claim that the application always runs at that speed.

Performance baselines MUST be recorded with exact commit identity and test conditions. Additional metrics such as FCP, LCP, INP, or TTI SHOULD be added only when they answer a demonstrated engineering question.

## 10. Repository Independence

`FLIX.ART` and `FLIXO-AI-TOOLS` share this engineering contract, not a shared product implementation.

A change in one repository MUST be evaluated against this contract and then ported deliberately to the other when it is broadly applicable. “Automatic transfer” means a controlled synchronization process or shared package/fixture—not unsupervised copying between repositories.

## Adoption Rule

When a project-specific design differs from this document, the project MAY specialize the implementation, but it MUST preserve the contract semantics above. Any deliberate exception belongs in the project's architecture or change-policy documentation with a concrete reason and verification coverage.
