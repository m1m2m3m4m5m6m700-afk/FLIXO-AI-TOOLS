# FLIXO — Execution Worker Assignments

هذه الورقة لا تنشئ authority جديدة. كل Worker هو role overlay على Control Plane الموجود، ولا يملك merge/promotion/certification أو direct-main authority.

## WORKER-01 — CONTROL / EVIDENCE
Mission:
- Exact-SHA reconciliation
- public surface inventory
- CI/evidence freshness
- workflow integrity
- release/certification packet
Inputs: المخطط التنفيذي.md; docs/FLIXO-EXACT-SHA-CERTIFICATION.md; docs/RELEASE-CHECKLIST.md; AGENTS.md
Exit: exact target SHA; stale evidence list; all required checks identified; no false-green path.

## WORKER-02 — RUNTIME / EXECUTION
Mission:
- canonical registry
- execution gate
- executor/verifier
- Agent Editor adapter
- ToolPlan integrity / TOCTOU
- terminal Verification Receipt
- 10-capability executable boundary
Exit: registry -> gate -> executor -> verifier invariant proven; no legacy execution import; no second execution authority.

## WORKER-03 — ROUTING / MODEL / MEMORY
Mission:
- Model Fabric admission
- provider adapter independence
- bounded fallback
- deterministic fallback
- memory advisory boundary
- structured errors/observability/idempotency
- prompt/tool-call semantic safety
Exit: only admitted models selected; no arbitrary model selection; bounded attempts; memory cannot bypass canonical validation.

## WORKER-04 — BROWSER / RED-TEAM
Mission:
- Agent Guided workflow
- Manual Standalone workflow
- browser-local execution
- network egress evidence
- Arabic/English/compound intents
- adversarial inputs and failure/recovery matrix
- build/runtime artifact identity
Exit: both workflows verified; no private byte egress; negative paths fail closed; exact-SHA browser evidence.

## Coordination
Order: WORKER-01 baseline -> WORKER-02 runtime -> WORKER-03 routing/model -> WORKER-04 browser/red-team -> final certification.
Each worker reads the current exact SHA, reports fact/gap, performs minimal mutation only for confirmed gap, runs targeted tests, invalidates stale evidence after mutation, and hands exact SHA forward.
No worker may claim certification.
## Current delegated issue packets
- WORKER-02 / P0-01: Issue #907; custom profile: .github/agents/flixo-p0-implementer.agent.md
- WORKER-03 / P0-02: Issue #908; custom profile: .github/agents/flixo-model-resilience.agent.md
- WORKER-04 / P0-03: Issue #909; custom profile: .github/agents/flixo-browser-privacy.agent.md
- WORKER-04 / P0-04: Issue #910; custom profile: .github/agents/flixo-redteam-certification.agent.md

Agent profile assignment through the Copilot API could not be completed by the connected GitHub integration (403); the issue packets and repository profiles are created and ready for Copilot assignment when the repository policy exposes that capability.
