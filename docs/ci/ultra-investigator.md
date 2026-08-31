# Ultra Recovery Gate

Ultra is the repository's fail-closed investigation layer for rapid root-cause discovery before and during contract recovery.

## Authority

The official workflow is `.github/workflows/ultra-investigator.yml`. It runs for pushes to `main`, pull requests targeting the canonical recovery branches, and manual dispatch.

The evaluator is defined by `scripts/ci/ultra-contract.mjs`. The contract is versioned and hashed; evidence records carry that hash and the exact checked-out commit SHA.

## Suites

Ultra evaluates nine independent domains:

- toolchain
- architecture
- localization
- seo
- security
- artifact
- runtime
- browser
- build

A full run requires every suite and every declared check to execute. Skipped or missing checks are failures, not passes.

## Evidence rules

Every suite records the expected SHA, actual SHA, tree SHA, contract hash, environment fingerprint, execution counts, command result, timing, and normalized failure signature.

The aggregate is accepted only when:

- every expected suite exists exactly once;
- every suite references the exact expected SHA;
- the checked-out tree is clean;
- the contract hash matches the current evaluator;
- executed count equals expected count;
- failures, skipped checks, missing checks, root causes, and unknowns are all zero;
- evidence is newer than 24 hours and tied to the current GitHub Actions run when run metadata is available.

## Failure intelligence

Ultra does not invent a competing failure taxonomy. It delegates classification to `scripts/ci/failure/taxonomy.ts` and aggregation to `scripts/ci/failure/engine.ts`. This keeps root-cause IDs stable across CI systems.

An unclassified failure remains `UNKNOWN` and fails the gate.

## Timeout safety

Every subprocess has a contract timeout. A timeout is recorded as a real failure and the child process is terminated. Browser and build checks have longer explicit limits; static checks have shorter limits to prevent silent hangs.

## Shared Evidence Ledger

The aggregate emits `ci-evidence/ultra-recovery.json` using the same `sha/expected/executed/passed/failed/skipped/missing/result` semantics consumed by `scripts/ci/evidence-ledger.mjs`. This prevents Ultra evidence from becoming a parallel evidence system.

## Official-gate semantics

The final job is named **Ultra Recovery Gate — OFFICIAL**. It is intentionally fail-closed: investigator failure, aggregate failure, evidence mismatch, stale evidence, unknown failures, or missing suites all prevent a PASS.

The workflow does not weaken or delete underlying tests. It is a diagnostic and integrity gate around the existing contracts.
