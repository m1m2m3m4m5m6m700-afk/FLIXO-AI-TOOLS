# FLIXO Cell Attendance & Upgrade Ledger

Every bot task has a **check-in** and a **check-out** record.

## Check-in
`botId, taskId, planId, planVersion, entrySha, scope, objective`

## Check-out
`attendanceId, exitSha, status, result`

For `COMPLETED`/ `VERIFIED`, evidence is mandatory. A `knowledgeId` records the returned learning item.

Statuses:
`COMPLETED | VERIFIED | BLOCKED | FAILED | ABORTED`

## Upgrade detection

Run:

```bash
node scripts/ci/cell-attendance.mjs assess
```

The report is written to:
`diagnostics/auto-repair/cell-attendance/upgrade-summary.json`

Signals include:
- task count
- failed/aborted rate
- blocked rate
- missing knowledge returns
- presence requests
- accumulated upgrade signals

States:
`NEEDS_MORE_EVIDENCE` → `COACHING_RECOMMENDED` → `UPGRADE_RECOMMENDED` → stable/reassessed.

The result is an evidence signal for `assistantController`. It **does not automatically grant permissions or mutation authority**.

## Attendance invariant

A bot with an open task cannot check in for another task. A completed checkout closes that attendance record. Every subsequent assessment works only from closed task records.
