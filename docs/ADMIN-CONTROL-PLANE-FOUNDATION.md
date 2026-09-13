# FLIXO Admin Control Plane — Foundation

Status: CANDIDATE / FOUNDATION IMPLEMENTED
Base: `main @ fcf5f7be198f4b6b480c555deaf1253968a05fd1`

## Purpose

Establish the current-architecture foundation for the exceptional Admin Control Plane without restoring the retired Admin graph.

The foundation introduces:

- a typed Admin capability vocabulary;
- a Truth/Evidence record model;
- an explicit fail-closed control-plane state;
- a private/noindex `/admin` control-plane surface;
- a module map for Command, Truth, Security, Contracts, Operations, Incidents, Changes, Approvals, Evidence and Truth Graph.

## Non-negotiable boundary

This foundation is **not** an authenticated production Admin system.

There is deliberately no client-side authentication, no fake session, no fake production status, no fake database data, and no production write capability.

Until a server-side identity + authorization + policy + persistence/evidence boundary exists, the runtime state is `UNAVAILABLE` and execution is `LOCKED`.

## Target architecture

```text
Admin UI
  -> Admin application boundary
  -> Identity / Session
  -> Role + Capability authorization
  -> Policy engine
  -> Approval engine
  -> Execution boundary
  -> Evidence ledger
  -> Truth graph
  -> Existing FLIXO system
```

The Admin UI must observe and govern the existing system; it must not become a second source of truth.

## Activation sequence

1. Foundation: current change.
2. Server boundary discovery: current deployment/runtime, persistence, secrets and environment contracts.
3. Identity/session implementation: HTTP-only server-managed session; no browser secret.
4. Capability authorization: explicit capability checks at the server boundary.
5. Read-only Truth/Operations/Evidence adapters backed by real current sources.
6. Approval + controlled write operations.
7. Rollback and audit verification.
8. Exact-SHA production certification.

No step may claim production capability before its corresponding evidence exists.

## Explicit exclusions

- No restoration of the retired `/admin` implementation.
- No historical dependency resurrection.
- No localStorage authentication.
- No mock analytics or synthetic production health.
- No direct LLM-to-production execution.
- No second registry or bespoke test matrix for every Admin module.
- No production writes from this foundation.
