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

## MVP scope invariants

- `FLIXO_MVP_SCOPE` is the canonical runtime contract for dual workflow, client-only file execution, static hosting, and offline execution.
- Every executable MVP capability must have both a manual route and registered agent intents, a canonical executor, output contract, and LOCAL/non-network execution.
- The agent gateway may receive only file metadata (`name`, `type`, `size`); raw `File`/`Blob` bytes stay in the browser.
- The local pipeline is the execution authority; provider calls may only assist planning and never receive user file bytes.

## External development-plane agents

- mini-SWE-agent is the REPAIR_WORKER: disposable-workspace patch candidate only; no push, branch creation, merge, promotion, or certification.
- CodeRabbit is the REVIEWER: review evidence only; no repository mutation or certification.
- Both adapters require exact-SHA evidence; stale SHA evidence is rejected.
- actionRepairBot remains the sole mutation seat and reviewAgent remains read-only.
- Sweep is outside the governed FLIXO repair path.
- The repair-worker workflow has GitHub read-only permissions and emits a patch artifact for the existing canonical control-plane path.

## MVP scope decision

The authoritative scope decision is documented in `docs/MVP-SCOPE-DECISION.md`. Agents must not add, remove, or reclassify executable MVP capabilities without changing the canonical contract and its tests.

## Bounded automation contract

The operational invariants for agent automation are documented in `docs/AGENT-AUTOMATION-CONTROL.md`.

They are mandatory guardrails, not a second authority system:
- Infrastructure Green, Product Green, and MVP Certified remain separate states.
- Autonomous work is bounded by attempts, time, mutations, and scope.
- Budget exhaustion is recovery/fail-closed escalation, never an unbounded retry.
- Agents propose; deterministic gates decide merge, CI/security changes, capability activation, and certification.
- ACTIVE/ready capabilities require the canonical Registry -> schema -> executor -> output contract -> verifier chain.
- Evidence is valid only for the exact SHA under verification.
- Manual tool routes must remain usable without the Agent Router.
- Red-team and human release review are required on the same SHA for MVP certification.
