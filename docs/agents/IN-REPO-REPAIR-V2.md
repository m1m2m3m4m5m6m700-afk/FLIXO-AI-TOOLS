# FLIXO In-Repo Repair Engine v2

## Purpose

The v2 repair contract converts source mutation from trial-and-error into an evidence-bounded causal pipeline.

`TRACE -> 3 HYPOTHESES -> INVARIANT -> SURGICAL PATCH -> FALSIFICATION -> TARGETED REGRESSION -> EXACT-SHA`

## RCA Manifest

Before source mutation, the repair engine must emit `FLIXO-IN-REPO-REPAIR-V2` with:

- the exact failure fingerprint and target SHA;
- one primary causal boundary;
- exactly three distinct hypotheses;
- a declared violated invariant;
- a minimum six-stage causal chain;
- one-source-file surgical scope;
- deterministic pre-mutation proof obligations.

A cycle above 3 is rejected. Cycles 2 and 3 require prior counterexample guidance instead of blind retry.

## Adversarial Falsifier

The post-patch assessor remains read-only. A rejection must include:

`REJECTED_WITH_COUNTER_EXAMPLE`

plus a replayable edge-case description and a convergence directive that identifies the missing guard and target invariant.

A successful adversarial pass emits:

`PASS_CONFIRMED`

and a finite-witness invariant proof. `PASS_CONFIRMED` is not Canonical GREEN; final promotion remains owned by the existing exact-SHA CI and certification gates.

## Finite invariant proof

The v2 proof checks a finite set of executable witnesses:

`EXACT_SHA && SINGLE_SOURCE_FILE && PRIMARY_BOUNDARY_MATCH && NO_GATE_WEAKENING && RCA_PROOF_FIELDS_PRESENT && ADVERSARIAL_PASS_CONFIRMED`

This is a deterministic finite-evidence proof, not a mathematical proof of correctness for all possible future executions.

## Integration points

- Policy: `configs/in-repo-repair-v2.yml`
- Manifest schema: `schemas/in-repo-repair-v2.schema.json`
- Engine contract: `scripts/ci/in-repo-repair-v2.mjs`
- Pre-mutation enforcement: `scripts/ci/auto-repair-engine.mjs`
- Adversarial verdict: `scripts/ci/post-patch-adversarial-assessor.mjs`
- Candidate gate: `scripts/ci/candidate-verification-parallel.mjs`
