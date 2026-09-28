# FLIXO Architecture Lock

This baseline is anchored to the current main branch. It defines authority boundaries; it does not add a second runtime.

## Locked topology

Human Authority
-> deterministic Control Plane
-> Planner / Executor / Verifier

Governance is deterministic CI/repository policy. Manual tool routes remain independent of the Agent Router.

## Allowed authority roles

- PLANNER: intent interpretation and plan proposal only.
- EXECUTOR: canonical registered execution only.
- VERIFIER: output/evidence verification only.
- GOVERNANCE: deterministic policy/gates only.

Advisory profiles and external workers are overlays, not additional authority classes.

## Prohibited autonomous authority

No Agent may independently merge to main, certify an MVP, change MVP scope, disable security/CI, delete tests, create a second registry, or create a second certification path.

## Bounded autonomy

Every execution is bounded by attempts, time, mutations, and scope. Exhaustion is BLOCKED/fail-closed.

## Evidence

Every accepted transition requires evidence bound to the exact SHA under verification. Skipped, cancelled, stale, contradictory, or missing required evidence is not success.

## Success-state separation

Infrastructure Green, Product Green, and MVP Certified are independent states. A lower state never implies a higher state.

## Change control

A new authority seat, mutation path, registry, execution path, or certification authority requires explicit Human Authority approval and contract tests.
