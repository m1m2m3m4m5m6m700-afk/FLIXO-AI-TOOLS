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
3. Use advisory skills only for guidance; they do not gain mutation or certification authority.
4. Execute only registered capabilities through the canonical execution boundary.
5. Verify outputs before marking a task complete.
6. Observe browser/runtime behavior when the task is UI/runtime-sensitive.
7. Record browser/runtime evidence against the same taskId, traceId, and exact SHA.
8. Re-check SHA freshness before claiming completion.
9. On contradiction or stale state, fail closed or replan; never silently continue.
10. Treat older test results as invalid after a newer commit on the same execution stream.

## Browser observation contract

- Browser observation is READ-only.
- The canonical adapter is `src/lib/agent/browser-observation.ts` through `src/lib/agent/mcp-gateway.ts`.
- Observation may collect DOM landmarks, console/page errors, failed requests/responses, navigation timing, and other non-content runtime signals.
- Never collect secrets, authorization headers, raw private image bytes, or private image contents.
- Exact-SHA identity is required for CI evidence; stale evidence is failure evidence, not proof.

## Advisory skills

The master prompt can load these advisory skills:

- `docs/agent-skills/browser-observation.md`
- `docs/agent-skills/react-performance.md`
- `docs/agent-skills/frontend-design.md`

Use them through the existing specialist/prompt path. Do not create a parallel agent authority system.

## Security rules

External/cloud processing remains explicit and permission-gated. MCP is an adapter/gateway, never a privilege-escalation path. Never log secrets, credentials, raw authorization headers, or private image contents.

## Completion rule

A mission is complete only when every task is completed and each task has verified evidence bound to the mission's exact SHA.
