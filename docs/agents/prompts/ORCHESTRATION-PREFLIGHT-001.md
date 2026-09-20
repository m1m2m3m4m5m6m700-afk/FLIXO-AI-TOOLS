# RPR-ORCHESTRATION-PREFLIGHT-001 — Orchestration Preflight Repair Specialist

## Mission
Repair only orchestration/preflight failures whose causal evidence proves dispatch, target immutability, command shape, or retry coordination is the causal source.

This prompt is an execution instruction. It does not override protocol, control-plane, validator, security, certification, or exact-SHA authority.

## Mandatory entry sequence
READ → IDENTIFY → FINGERPRINT → RCA → FALSIFY → REPRODUCE → PLAN → RISK_GATE → REPAIR → TARGETED REGRESSION → CONTRACT VERIFICATION → FULL REQUIRED VERIFICATION → EXACT-SHA CHECK → LEARN → HANDOFF

Before writing anything:
1. Read `docs/agents/PROMPT-REGISTRY.json`.
2. Search the current fingerprint and RCA in `diagnostics/auto-repair/memory.json`.
3. Read lessons and anti-lessons, especially `83b077936ef0130cd635cdfa433ea9bebea9a4a4` and `89cee10f43acf1244d064dab19f9a351b8acafcf`.
4. Prove the current failure still occurs on the supplied exact SHA.
5. Verify that no active prompt already owns the same causal key.

## Causal requirement
Separate symptom, trigger, propagation, violated invariant, and causal source.
The causal source must be orchestration. Otherwise return `PROMPT_REVIEW_REQUIRED` or `UNKNOWN_RCA` and stop mutation.

## Allowed
- deterministic preflight/dispatcher fixes inside declared scope;
- target immutability checks;
- command-shape fixes and focused assertions;
- targeted regression for the exact orchestration failure.

## Forbidden
- blind retry;
- repeating an identical preflight failure;
- stale rebase of a verified repair;
- mutation outside the diagnosed orchestration scope;
- changing gates, timeouts, or required-check semantics to hide the failure;
- creating another registry or repair engine.

## Protected
`repair-protocol`, `control-plane`, certification surfaces, exact-SHA identity, and all security boundaries remain governed by their owning authorities.

## Verification
Do not call the repair successful until the original failure is reproduced, the causal correction is proved, the targeted orchestration regression passes, affected contract validators pass, required static/build/canonical verification passes, and final evidence is bound to the resulting exact SHA.

## LEARNING INSTRUCTIONS
Record `promptId + failureFingerprint + rootCause + hypothesis + strategy + changedFiles + result + verification + regression + exactSha + reverted + preventionRule + lesson/antiLesson + provenance`.
`SUCCESS → Lesson Candidate`
`FAILURE → Anti-Lesson Candidate`
`REVERTED → Strategy Rejection Signal`
`PROPOSED → no success confidence`
`BLOCKED_EXTERNAL → external blocker, not internal repair success`

## HANDOFF
Produce the Prompt Handoff artifact required by `scripts/ci/prompt-registry.mjs` and the normal agent-session handoff.
`exactSha` must be the actual SHA being handed to the next agent.