# FLIXO Prompt Sorting Inventory

## MASTER PROMPT SOURCE
`المهام.md`

All prompt text, prompt lineage, review copies, and consolidation decisions are mastered in `المهام.md`. This is the only human/review/task prompt source of truth.

## CANONICAL ACTIVE PROMPTS — EXACTLY TWO

1. `RPR-UNIFIED-EXECUTION-001` → `docs/agents/PROMPT-UNIFIED-EXECUTION.md`
   - owns repository execution, engineering, repair/RCA, task preparation, prompt governance, verification sequencing, and completion.
   - former Prompt-01, Prompt-02, Task Agent, and specialist repair prompts are modes/modules inside this prompt.
2. `FLIXO-IMAGE-AGENT-MASTER-001`
   - owns customer-facing image-intelligence/conversational behavior only.
   - no repository mutation, certification, control-plane, or repair authority.

Engineering task IDs and atomic execution definitions are task/module data consumed by the two canonical prompts; they are not independent prompt authorities.

## HISTORICAL / DEPRECATED
RPR-ERROR-RCA-001 → docs/archive/agents/prompts/RPR-ERROR-RCA-001.md → Error Agent + Unified Prompt
RPR-PROMPT-INTEL-001 → docs/archive/agents/prompts/RPR-PROMPT-INTEL-001.md → Prompt Registry + Unified Prompt
RPR-REGEX-CONTRACT-001 → docs/archive/agents/prompts/REGEX-CONTRACT-001.md → contract validators + Unified Prompt
RPR-ARCHITECTURE-REGISTRY-001 → docs/archive/agents/prompts/ARCHITECTURE-REGISTRY-001.md → registry/protocol contracts + Unified Prompt
RPR-EXTERNAL-TOOLING-001 → docs/archive/agents/prompts/EXTERNAL-TOOLING-001.md → BLOCKED_EXTERNAL + Unified Prompt
RPR-ORCHESTRATION-PREFLIGHT-001 → docs/archive/agents/prompts/ORCHESTRATION-PREFLIGHT-001.md → Repair Protocol + Unified Prompt
RPR-TASK-AGENT-SYSTEM-001 → docs/archive/agents/prompts/TASK-AGENT-SYSTEM-PROMPT.md → Task Preparation Mode + Unified Prompt
RPR-MASTER-LIFECYCLE-001 → docs/archive/agents/AI_AGENT_MASTER_PROMPT.md → Image Runtime Prompt

Rule: archived, redirect, and compatibility paths do not create a second active prompt authority. Any new prompt content must first be consolidated into `المهام.md`.
