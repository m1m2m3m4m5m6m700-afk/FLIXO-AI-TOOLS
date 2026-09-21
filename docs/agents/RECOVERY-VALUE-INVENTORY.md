# FLIXO — RECOVERY VALUE INVENTORY

Status: **RECOVERY AUDIT — PRESERVE / ABSORB / DO-NOT-RESTORE**

Purpose: record valuable repository system contracts discovered during historical recovery so that useful behavior is not lost while preventing duplicate authorities.

## Current canonical state

- Canonical working lane: `execution`
- Production/source-of-truth: `main`
- Absolute branch invariant: **never create a new branch**
- Canonical prompt: `RPR-UNIFIED-EXECUTION-001`
- Canonical prompt source: `docs/agents/PROMPT-UNIFIED-EXECUTION.md`
- Runtime file `src/lib/agent/flixo-agent-master-prompt.ts` is an adapter only.
- Prompt inventory: `docs/agents/PROMPT-SORTING-INVENTORY.md`

## High-value recovery findings

| Source | Historical SHA / ref | Classification | Decision |
|---|---|---|---|
| `docs/agents/ACTIVE-REPAIR-CYCLE-PROTOCOL.md` | `b61c05a47b87b27690de52a7885862566aaa1798` on main | Missing operational protocol on execution | **RESTORE/ADAPT** — restored on execution and aligned to current authority model. |
| `docs/agents/TASK-AGENT-SYSTEM-PROMPT.md` | `8e18fd5458960a329e39f42ea481b8b4e42254c8` on main | High-value preparation/liveness contract but is a prompt | **ABSORB** — packet, baseline, liveness, scope, and handoff rules merged into unified prompt; machine implementation remains `scripts/ci/task-agent.mjs`. |
| `docs/agents/prompts/RPR-ERROR-RCA-001.md` | `093d5ce9dfd5c6f103e716559dbf5cd49f0514f4` on main | High-value RCA/falsification specialist prompt | **ABSORB** — Error Agent + unified prompt retain causal packet/falsification/stage boundaries. |
| `docs/agents/prompts/PROMPT-02-ERROR-INTELLIGENCE.md` | `9ee40f1c18e44afb2ce88360740ac900d21d2f20` on agent-knowledge-vault-200k | Historical repair-intelligence prompt | **ABSORB / HISTORICAL** — canonicalized into unified prompt; do not reactivate as sibling prompt. |
| `AI_AGENT_MASTER_PROMPT.md` | `75174ffe31da6967e5d36461b5822d5ee6203db5` on main | Legacy master prompt | **ABSORB / HISTORICAL** — key gates and inspection doctrine are in unified prompt. |
| `docs/agents/prompts/RPR-PROMPT-INTEL-001.md` | `f761771b56deaa411d13e75b7fb32c548fac4a53` | Prompt governance specialist | **ABSORB** — reuse/extend/merge/duplicate/quality rules remain in Prompt Registry + unified prompt. |
| `docs/agents/prompts/REGEX-CONTRACT-001.md` | `69ab1474dab0aa8718e91...` | Narrow contract specialist | **ABSORB** — exact emitted-text + semantic-vs-syntax + no-weakening rules are now in unified prompt. |
| `docs/agents/prompts/ARCHITECTURE-REGISTRY-001.md` | `6a2901a133da7b44edcae94573b466eb8c7b4820` | Registry symmetry specialist | **ABSORB** — workflow→registry→validator→supervisor symmetry is now explicit in unified prompt. |
| `docs/agents/prompts/EXTERNAL-TOOLING-001.md` | `9e5168696bc3a5dd2949df19df58a91dcce9c039` | External blocker specialist | **ABSORB** — BLOCKED_EXTERNAL proof boundary is now explicit in unified prompt. |
| `docs/agents/prompts/ORCHESTRATION-PREFLIGHT-001.md` | `c24a3efa6bcc94817d5558bcb2aa23f3e332b0a8` | Orchestration specialist | **ABSORB** — target immutability, command-shape, no stale rebase/blind retry controls are in unified prompt. |
| `docs/agents/prompts/CANONICAL-CONTRACT-DRIFT-001.md` | `940f383fb26dec6e728c93137294eb519ef58c07` | Liveness/heartbeat ownership specialist | **ABSORB** — canonical contract ownership, protected rest-state compatibility, heartbeat duplicate-dispatch protection are in unified prompt. |

## Existing execution contracts confirmed valuable

Already present on `execution` and retained:
- `docs/EXECUTION-BRANCH-PROTOCOL.md`
- `docs/AGENT-HISTORICAL-RECOVERY.md`
- `docs/AGENT-COLLABORATION-PROTOCOL.md`
- `docs/AGENT-COORDINATION-CONTROL-PLANE.md`
- `docs/AGENT-HANDOFF-REPORT-SCHEMA.md`
- `docs/agents/ERROR-AGENT.md`
- `docs/agents/ERROR-TEACHING-ROUTER.json`
- `docs/agents/SELF-HEALING-AGENT-SCOPE-PROTOCOL.md`
- `docs/ERROR-LEARNING-AUTONOMOUS-MODE.md`
- `scripts/ci/task-agent.mjs`
- `scripts/ci/agent-execution-control.mjs`
- `diagnostics/auto-repair/memory.json`

## Important contract correction discovered

Historical Self-Healing text contained an obsolete **isolated repair branch** instruction. This conflicts with the current immutable two-branch topology. The execution copy has been corrected to require mutation on `execution` only.

## Why not restore every historical prompt file?

Restoring every historical specialist prompt would recreate the exact multi-authority/prompt-drift problem the consolidation solved. Their **validated behavior is preserved**, their provenance remains in `PROMPT-SORTING-INVENTORY.md`, and the single canonical prompt now carries the recovered operational rules.

## Recovery rule

`SEARCH → CLASSIFY → ABSORB/RESTORE/KEEP-LEGACY → VERIFY → RECORD PROVENANCE`

Never copy historical files wholesale without contract comparison and exact-SHA verification.
