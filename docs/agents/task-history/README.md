# FLIXO Immutable Historical Task Ledger

## Purpose

Every task execution must leave a permanent historical record. The historical ledger is append-only: existing records are never edited or deleted. A correction, retry, re-run, or reversal is represented by a new record linked to the prior execution.

## Canonical file

`docs/agents/task-history/ledger.jsonl`

One JSON object per line. The file is historical data, not an active task queue. The active task source remains `المهام.md`.

## Execution identity

Each record is uniquely identified by:

`taskId + sessionId + entrySha`

The same task may therefore have multiple historical executions without overwriting an earlier attempt.

## Required evidence

Records capture the execution identity, actor/role, chair, entry/exit SHA, lifecycle status, timestamps, evidence, findings, final summary, and linkage to the current task source where available.

## Immutability rules

- Existing ledger lines MUST NOT be modified.
- Existing ledger lines MUST NOT be deleted.
- Historical records MUST NOT be rewritten in place.
- Corrections and retries MUST append a new record.
- The ledger validator fails closed on malformed JSON, duplicate execution identities, conflicting duplicate records, or deletion/modification of historical lines.
- Automation may append missing execution records, but may never rewrite the existing prefix of the ledger.

## Automation

`scripts/ci/task-history-ledger.mjs` reconciles `diagnostics/agents/coordination-state.json` into the ledger and verifies append-only integrity.

`.github/workflows/task-history-ledger.yml` runs the reconciliation on `execution` pushes and validates immutability on pull requests/pushes. The workflow only appends missing history records; it does not change the active task queue.
