# FLIXO Platform Architecture v1

> **STATUS: HISTORICAL / SUPERSEDED.** This document is preserved for evidence only. It is not a current architecture authority and must not impose image-only product constraints on the target FLIXO platform. Current architectural decisions are governed by the canonical task ledger, executable contracts, Capability Registry, and exact-SHA evidence.

## Purpose

Transform FLIXO from an image-tool collection into an **Agentic Visual Execution Platform** without duplicating or replacing working foundations.

## Architectural decision

The existing image platform remains the first-party product surface. The platform core is extracted conceptually from existing contracts; no parallel Registry, Execution Engine, Verification system, or Error Memory is introduced.

## Current foundation classification

### Platform Core candidates — promote/reuse

- Agent reasoning, planning, knowledge, evaluation, supervision and learning under `src/lib/agent/`.
- Tool/Capability discovery and the existing Capability Registry.
- `src/config/registry.ts` and `src/config/tool-platform/` as the canonical registry/catalog foundation.
- Workflow pipeline execution and existing resource/verifier boundaries.
- Image-core document/layer/selection validation as a reusable artifact model.
- Final QA contract and deterministic verification boundaries.
- Error Memory / fingerprint / RCA / learning infrastructure.
- Candidate Builder with promotion blocked until independent verification and approval.
- Performance Engine work as the execution-fabric optimization layer.

### Image-specific first-party surface

- Current image tools and image-processing executors.
- Image codecs, canvas/image bitmap paths, image-specific parameter schemas.
- Image editing UI, image routes, filters, image session/history UX.
- Image-specific visual QA rules.

### Future platform adapters — not implemented in V1

- Developer SDK/API.
- Webhooks/integrations.
- Third-party capability extensions.
- Non-image media adapters.

These remain extension points only; V1 does not add video/audio systems.

## Target platform

```
FLIXO
├── Intelligence Core
│   ├── Understanding
│   ├── Reasoning
│   ├── Planning
│   ├── Context / Memory
│   └── Evaluation
├── Capability Graph
│   ├── Canonical Registry
│   ├── Discovery
│   ├── Composition
│   ├── Candidate Builder
│   └── Version / Promotion State
├── Execution Fabric
│   ├── Existing Pipeline
│   ├── Browser Local
│   ├── Worker
│   └── Future Remote Adapter
├── Verification
│   ├── Deterministic Verification
│   ├── Visual QA
│   └── Final Gate
├── Evolution
│   ├── Error Memory
│   ├── Fingerprint / RCA
│   ├── Candidate Evaluation
│   └── Controlled Promotion
└── Product Experiences
    └── Image Editing (V1)
```

## Capability contract

A capability is the stable unit of agent execution. Tools are user-facing experiences or bindings to capabilities.

Required lifecycle:

`DISCOVERED → CONTRACT_VALIDATED → TESTED → SECURITY_VERIFIED → AGENT_COMPATIBLE → PROMOTION_PENDING → ACTIVE`

Candidates may never mutate the active registry directly.

## Capability Graph V1

The graph is logical first; it reuses the existing Registry rather than creating a second data store.

Node classes:
- capability
- executor
- verifier
- workflow
- candidate
- artifact

Edge classes:
- `CAN_COMPOSE_WITH`
- `EXTENDS`
- `EXECUTES_AS`
- `VERIFIED_BY`
- `PRODUCES`
- `DEPENDS_ON`

## Request lifecycle

```
Request
→ Understand
→ Discover capabilities
→ Compose / Extend / Candidate
→ Plan
→ Execute
→ Inspect
→ Repair / Re-plan
→ Verify
→ Final QA
→ Deliver
```

Unknown capability:

```
Failure
→ Error Memory
→ Fingerprint
→ RCA
→ Capability Gap
→ Candidate Builder
→ Sandbox
→ Independent Verification
→ Approval
→ Registry
```

## Non-goals for V1

- No second Registry.
- No second Execution Engine.
- No second QA system.
- No autonomous production promotion.
- No video/audio platform.
- No mass tool creation.
- No rewrite of working image infrastructure.

## Migration strategy

1. Freeze current contracts as compatibility boundaries.
2. Map existing modules to Platform Core vs Image Surface.
3. Add platform-level types only where a real shared abstraction exists.
4. Adapt existing Registry/Execution/Verification rather than replacing them.
5. Move one capability path at a time behind the shared contract.
6. Prove no behavior regression after each migration.
7. Keep image editing as the first product experience while platform abstractions mature.

## V1 acceptance

- One canonical Registry remains.
- One Execution path remains.
- One Verification/Final QA path remains.
- Existing image tools continue to work.
- Agent can reason over capability identity rather than tool names alone.
- Capability Builder candidates remain non-production.
- Error Memory can feed capability-gap discovery.
- No new media domain is introduced.
- Typecheck, lint, build and targeted regression remain required.
