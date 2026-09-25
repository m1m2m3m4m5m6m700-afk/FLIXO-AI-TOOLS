# FLIXO BOT — Collective Intelligence Runtime

## Purpose

The repository already defines a system-wide brain in `docs/agents/FLIXO-BOT.json`:

- `FLIXO-BOT-BRAIN-v1`
- one shared cognitive kernel with role overlays
- 60 active learning consumers
- 97 merged cognitive capabilities

This change makes that intelligence **runtime-visible to the human-facing and execution cognitive layers**.

## Runtime bridge

Canonical bridge:

`src/lib/agent/collective-intelligence.ts`

It provides a deterministic reasoning frame containing:

`OBSERVE → INVENTORY → CLASSIFY → CORRELATE → BUILD_WORLD_MODEL → GENERATE_HYPOTHESES → DISCRIMINATE_WITH_EVIDENCE → CHALLENGE_ADVERSARIALLY → SCOPE_MINIMAL_CHANGE → SIMULATE_OR_PREDICT → TARGETED_REGRESSION → VERIFY_EXACT_SHA_AND_LEARN`

The frame selects relevant reasoning lenses and role perspectives for the current request.

## What is inherited

The runtime inherits the **reasoning patterns** represented by the repository's agents/bots: RCA, evidence/provenance, historical reasoning, adversarial review, security-boundary analysis, dependency/impact analysis, regression planning, recovery, learning, and human-intent modeling.

It does **not** copy executor code, permissions, Git authority, certification authority, or control-plane authority.

## Safety invariant

Collective intelligence is:

- advisory only
- non-mutating
- non-certifying
- exact-SHA aware
- stale-knowledge aware
- contradiction-preserving
- fail-closed on uncertainty

Therefore the agent can think with the project's collective reasoning substrate without becoming a second governance or execution plane.

## Verification

The contract test is:

`scripts/test-agent-collective-intelligence.mjs`

It verifies that the runtime bridge stays synchronized with `docs/agents/FLIXO-BOT.json` and that English/Arabic failure and repair requests activate the expected reasoning lenses.


## Shared operational learning

The server-side conversation gateway also reads the canonical shared operational memory for the `executionAgent` identity and supplies bounded advisory context containing lessons, anti-lessons, observed errors, proof obligations, counterexamples, and verification records.

The learning channel remains non-authoritative:

- shared memory is context, not certification;
- stale or historical knowledge must be requalified against the current exact SHA;
- contradictions remain visible until current evidence resolves them;
- memory cannot grant execution, mutation, merge, or certification authority.

The execution-agent clone reaches the same brain through the cognitive orchestrator, so the clone and the original execution path share the reasoning substrate without sharing mutation ownership.


## Full-intelligence rule

All active learning consumers use `FLIXO-FULL-INTELLIGENCE-v1` in `FULL_ALWAYS` mode.

A task being simple is **not** a reason to reduce the cognitive substrate. Every consumer receives the same full reasoning lens set, shared learning context, Exact-SHA binding, adversarial review posture, verification obligations, and anti-lesson context. Resource ceilings remain role-bound; permissions and mutation authority are never increased by this policy.

Enforcement:

- `scripts/ci/full-intelligence-policy.mjs`
- `scripts/ci/agent-session.mjs`
- `scripts/council/advanced-agent-runtime.mjs`
- `scripts/council/frontier-specialist-runtime.mjs`
- `scripts/council/action-agent-triad.mjs`
- `scripts/council/external-gpt-bridge.mjs`
- `scripts/ci/action-agent-runtime.mjs`
- `scripts/ci/action-repair-council-20.mjs`
- `scripts/security/security-red-team-runner.mjs`
- `scripts/ci/auto-repair/reasoning.mjs`

The contract test iterates over the complete `distribution.learningConsumers` audience and rejects missing or downgraded cognitive bootstraps.
