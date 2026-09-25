# FLIXO Cleanup State Ledger

## Current State
- main HEAD: 2299528caf964133513d615b7b91b1e7e226cb20
- execution HEAD: 8da19098e14fe96eae8d87fbb2364cc93e21b2ae
- last merge: PR #809 → main (2299528c)
- last closed RC: RC-Self-Referential (8da19098)

## Open RCs
- RC-WP0PostMerge (in progress, see below)
- RC-CICleanupDebts (D1/D3/D4/D5 pending)
- RC-HeartbeatResidency (documented, not blocking)

## Phases
- PHASE 1 (inventory): partial
- PHASE 2 (RC-Self-Referential): closed
- PHASE 3 (post-merge stabilization): in progress
- PHASE 4 (debt removal): pending

## Confirmed Debts
- D2 groups (3 groups, 13 files):
    1. SHA d59270bc... → AI_AGENT_MASTER_PROMPT.md + 6 prompts
    2. SHA 682ed5c1... → 4× ACTION-*-INDEX-4000.json
    3. SHA 52b6b346... → validate-architecture{,-v2}.mjs
- D6: docs/AUTO_REPAIR_HISTORY.jsonl (0 bytes)
- D1/D3/D4/D5: BLOCKED (tool limitation)

## Control-Plane Topology
- execution-bot-watchdog ↔ agent-repair-heartbeat:
  workflow_run + artifact consumption + dispatch-on-absence
- required checks on main: trust-gate, Exact-SHA promotion proof
- daily-flixo-green-gate: schedule-only, main-only
- WP0 Trust Baseline: fails on main post-merge
  (TASK_PREPARATION_REQUIRES_EXECUTION_BRANCH)

## Critical Events
- 2595416a → 8da19098: authorized continuation
- orphan commit f140eff1: abandoned, unreferenced
- PR #809: merged to main at 2299528c
- MAIN_DIVERGENCE: resolved at root (behind_by = 0)
- WP0 failure: new post-merge RC

## Decisions
- strategy (C) for SHA removal: DONE
- D1..D6 definitions
- all writes to main via PR only
- do NOT touch heartbeat/watchdog until refactor

## Next Action
- resolve WP0 TASK_PREPARATION_REQUIRES_EXECUTION_BRANCH
- fix continuous-error-watch.mjs MAIN_DIVERGENCE
- complete D1 scan via temporary workflow
- address D2 duplicates
