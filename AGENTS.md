# FLIXO Agent Execution Contract

This file is an agent-harness entry point, not an independent authority source.

## Canonical authority

Use the existing FLIXO runtime contracts as the source of truth:

- Capability identity: `src/lib/agent/capability-registry.ts`
- Execution boundary: `src/lib/agent/execution-gate.ts`
- Task state: `src/lib/agent/task-state.ts`
- Agent profiles: `src/lib/agent/agent-profile.ts`
- Mission/task/evidence lifecycle: `src/lib/agent/mission-contract.ts`
- Outcome and learning contract: `src/lib/agent/cognitive-outcome.ts`

Do not create a second tool registry, authority model, certification mechanism, or execution path.

## Required execution loop

1. Read the current task and exact commit SHA.
2. Build or load the mission/task graph.
3. Execute only registered capabilities through the canonical execution boundary.
4. Verify outputs before marking a task complete.
5. Record evidence against the same exact SHA.
6. Re-check SHA freshness before claiming completion.
7. On contradiction or stale state, fail closed or replan; never silently continue.
8. Treat older test results as invalid after a newer commit on the same execution stream.

## Security rules

External/cloud processing remains explicit and permission-gated. MCP is an adapter/gateway, never a privilege-escalation path. Never log secrets, credentials, raw authorization headers, or private image contents.

## Completion rule

A mission is complete only when every task is completed and each task has verified evidence bound to the mission's exact SHA.
