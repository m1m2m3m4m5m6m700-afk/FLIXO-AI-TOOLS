# Safe Task Agent Execution

The Task Agent repairs GitHub Actions through a repair branch and pull request. Canonical CI is the merge gate. Direct mutation of `main` is not permitted.

Lifecycle: diagnose -> prove cause -> modify -> verify -> commit -> push repair branch -> canonical CI -> merge only after exact-SHA GREEN -> reverify main.

A cancelled, skipped, timed-out, stale, or failed required check is never treated as GREEN.
