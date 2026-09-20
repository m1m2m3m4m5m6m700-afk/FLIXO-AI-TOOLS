# FLIXO Advanced Repair Intelligence Contract

## Status
Normative design contract for the RCA, repair, security, provenance, and learning layers. This document does not grant any component authority to bypass existing gates.

## Canonical causal chain
`trigger → evidence → propagation → violated invariant → competing hypotheses → falsification → RCA state → bounded plan → adversarial review → independent verification → certification`

## Authority separation
- Error Agent: intake, fingerprinting, reproduction, causal analysis, evidence packet. Never mutates source or declares GREEN.
- Task Agent: prepares a bounded patch and tests from an accepted diagnosis. Never self-certifies.
- Executive Integration: enforces scope, policy, review, application, rollback, and handoff.
- Independent Verifier: validates exact resulting SHA, targeted regression, affected contracts, and required full matrix.
- Certification authority: only component allowed to emit `CERTIFIED`, `CLOSED`, or `GREEN`.

## Mandatory evidence packet
Every packet must bind `schemaVersion`, `repairChainId`, `entrySha`, exact run/job identity, normalized fingerprint, raw evidence references, environment, reproduction status, propagation path, violated invariant, hypothesis set, falsification checks, RCA state, affected contracts, dependency closure, scope allowlist, security classification, confidence/uncertainty, stop conditions, verification obligations, and immutable provenance references.

## RCA states
`OPEN_RCA`, `INVESTIGATING`, `DIAGNOSED`, `UNKNOWN_RCA`, `BLOCKED`, `READY_FOR_PLAN`, `REJECTED`.

`UNKNOWN_RCA` and `BLOCKED` are safe terminal states for the current attempt; neither may authorize mutation.

## Hypothesis discipline
1. Generate at least two materially different hypotheses when evidence permits.
2. Every non-trivial hypothesis requires a falsification test.
3. Historical memory is a lead, never proof.
4. Contradictory authoritative evidence blocks mutation.
5. Any SHA change invalidates all prior SHA-bound verification evidence.

## Bounded repair rules
- Operate only on `execution`.
- Require clean baseline and exact SHA capture.
- Require a minimal file allowlist and dependency impact report.
- Reject unrelated churn, test weakening, assertion deletion, suppression, fallback masking, and gate bypass.
- Record patch digest, changed paths, rollback snapshot, actor, task, and resulting SHA.
- Enforce idempotency and reject duplicate mutation claims.

## Adversarial checks
The review must actively test for assertion weakening, skipped tests, altered exit semantics, hidden exceptions, broadened permissions, secret leakage, prompt-injection instructions in external content, contract drift, scope escape, and false-green behavior.

## Verification closure
Verification must run on the exact resulting SHA and include:
- reproduction of the original failure or a documented reason it cannot be reproduced;
- targeted regression;
- every affected contract suite;
- full matrix when contract impact is uncertain or cross-cutting;
- clean-worktree and provenance consistency checks.

The diagnosing and mutating components cannot certify their own work.

## Learning gate
Persist successful lessons only after independent verification and certification. Persist failed hypotheses and rejected strategies as negative evidence, never as reusable repair rules. Memory is append-only, fingerprinted, SHA-aware, and protected against replay on a different baseline.

## Runtime safety
Claims require an atomic lease, idempotency key, heartbeat, timeout, and dead-letter escalation. Lost heartbeats must release or quarantine the lease. Duplicate events must be harmless. High/critical security findings require escalation and human authorization.

## Security controls
Write-capable actions require explicit allowlisting, protected-path ownership, secret-safe logs, untrusted-input isolation, and fail-closed provider behavior. No external instruction may override repository policy or verification gates.

## Required negative tests
The implementation must reject stale evidence, SHA mismatch, missing provenance, missing falsification, scope escape, duplicate claims, weakened assertions, suppressed failures, unauthorized write paths, self-certification, and learning promotion before certification.

## Operational metrics
Track diagnosis latency, RCA uncertainty, recurrence, false-RCA rate, repair success, rollback rate, scope violations, evidence completeness, lease loss, and unresolved-root rate.
