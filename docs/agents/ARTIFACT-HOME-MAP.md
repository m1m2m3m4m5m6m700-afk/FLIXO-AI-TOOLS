# FLIXO Canonical Artifact Home Map

خريطة مكانية فقط؛ لا تضيف سلطة جديدة.

## Prompts
ACTIVE: docs/agents/PROMPT-UNIFIED-EXECUTION.md
Prompt registry: docs/agents/PROMPT-REGISTRY.json
Prompt execution/selection engine: scripts/ci/prompt-registry.mjs
Prompt intelligence helpers: scripts/ci/prompt-intelligence.mjs
Historical prompt archive: docs/archive/agents/prompts/ + docs/archive/agents/AI_AGENT_MASTER_PROMPT.md
Legacy prompt paths: compatibility/history only; never an ACTIVE source.

## Agent contracts
Task: docs/agents/TASK-AGENT.md + scripts/ci/task-agent.mjs
Error/RCA: docs/agents/ERROR-AGENT.md
Self-healing: docs/agents/SELF-HEALING-AGENT-SCOPE-PROTOCOL.md
Repair cycle: docs/agents/ACTIVE-REPAIR-CYCLE-PROTOCOL.md
Safe mutation: docs/agents/SAFE-TASK-AGENT-EXECUTION.md
Collaboration: docs/AGENT-COLLABORATION-PROTOCOL.md
Coordination: docs/AGENT-COORDINATION-CONTROL-PLANE.md
Handoff: docs/AGENT-HANDOFF-REPORT-SCHEMA.md
Cooperation: docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json
Branches: docs/EXECUTION-BRANCH-PROTOCOL.md
Protocol hierarchy/registry: docs/PROTOCOL-HIERARCHY.md + docs/PROTOCOL-REGISTRY.json
Liveness: scripts/ci/agent-liveness-protocol.mjs

## Commands
Session: scripts/ci/agent-session.mjs
Coordination: scripts/ci/agent-coordination.mjs
Repair admission/commit boundary: scripts/ci/repair-protocol.mjs
Error teaching router: scripts/ci/error-teaching-router.mjs
Prompt registry: scripts/ci/prompt-registry.mjs
Protocol/task/agent validators: scripts/ci/validate-*.mjs
Static preflight: scripts/ci/run-static-preflight.mjs
package.json scripts are aliases, not second authorities.

## State
Tasks: المهام.md
Project map: PROJECTS.md
Error memory: diagnostics/auto-repair/memory.json
Sessions/handoffs/coordination: diagnostics/agents/
Durable agent visibility: docs/agents/ledger/
Teaching corpus/router: docs/agents/ERROR-TEACHING-*.md + ERROR-TEACHING-ROUTER.json