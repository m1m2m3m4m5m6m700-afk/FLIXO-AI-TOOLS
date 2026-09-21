# FLIXO Prompt Sorting Inventory

## MASTER PROMPT SOURCE
`المهام.md`

All prompt text, prompt lineage, review copies, and consolidation decisions are mastered in `المهام.md`. This is the only human/review/task prompt source of truth.

## ACTIVE RUNTIME PROJECTION
RPR-UNIFIED-EXECUTION-001 → `docs/agents/PROMPT-UNIFIED-EXECUTION.md`

The runtime file above is a machine-consumed projection of the active prompt stored in `المهام.md`; it is not a second prompt authority and must not diverge from the ledger.

## HISTORICAL / DEPRECATED
RPR-ERROR-RCA-001 → docs/archive/agents/prompts/RPR-ERROR-RCA-001.md → Error Agent + Unified Prompt
RPR-PROMPT-INTEL-001 → docs/archive/agents/prompts/RPR-PROMPT-INTEL-001.md → Prompt Registry + Unified Prompt
RPR-REGEX-CONTRACT-001 → docs/archive/agents/prompts/REGEX-CONTRACT-001.md → contract validators + Unified Prompt
RPR-ARCHITECTURE-REGISTRY-001 → docs/archive/agents/prompts/ARCHITECTURE-REGISTRY-001.md → registry/protocol contracts + Unified Prompt
RPR-EXTERNAL-TOOLING-001 → docs/archive/agents/prompts/EXTERNAL-TOOLING-001.md → BLOCKED_EXTERNAL + Unified Prompt
RPR-ORCHESTRATION-PREFLIGHT-001 → docs/archive/agents/prompts/ORCHESTRATION-PREFLIGHT-001.md → Repair Protocol + Unified Prompt
RPR-TASK-AGENT-SYSTEM-001 → docs/archive/agents/prompts/TASK-AGENT-SYSTEM-PROMPT.md → Task Agent Contract + Unified Prompt
RPR-MASTER-LIFECYCLE-001 → docs/archive/agents/AI_AGENT_MASTER_PROMPT.md → Unified Prompt

Rule: archived, redirect, and compatibility paths do not create a second active prompt authority. Any new prompt content must first be consolidated into `المهام.md`.
