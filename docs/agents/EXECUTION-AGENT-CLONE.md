# FLIXO Execution Agent Clone

## Identity

`src/lib/agent/execution-agent-clone.ts` is a reusable behavioral clone of the canonical execution agent.

Clone ID: `execution-agent-clone-v1`

The clone reuses the existing `executionAgent` role identity. It does not create a second agent authority, registry, executor, branch, or governance plane.

## Canonical flow

`request → Cognitive Orchestrator → Intent/World Model → semantic guard → Execution Integrator → TaskState → Execution Gate → Pipeline Runner → verification → outcome/learning`

The clone exposes bounded lifecycle operations for cognitive assessment, preparation, explicit confirmation, cancellation, execution through the existing Pipeline Runner, policy-bound recovery, and outcome/error-memory binding.

## Authority boundaries

| Layer | Authority |
|---|---|
| LLM / conversation | Proposal only |
| Cognitive Orchestrator | Understanding + bounded plan semantics |
| Capability Registry | Canonical capability authority |
| Execution Gate | Authorization |
| TaskState | Lifecycle authority |
| Pipeline Runner | Actual execution authority |
| Verifier / Output Contract | Result authority |
| Learning Memory | Advisory outcome memory only |

## Non-goals

The clone does not register tools, implement an Executor, mutate `main`, create branches, bypass confirmation, bypass verification, grant itself permissions, treat memory as execution authority, or perform blind retry loops.

## Regression contract

`scripts/test-agent-execution-agent-clone.mjs` verifies the clone identity, lifecycle, recovery boundaries, exact-SHA outcome binding, and absence of direct executor/Git mutation authority.
