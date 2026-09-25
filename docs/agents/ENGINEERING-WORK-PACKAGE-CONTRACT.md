# FLIXO Engineering Work-Package Contract

The repair flow is now enforced as:
`LIVE STATE → RCA → CONTRACT IMPACT → ONE WORK PACKAGE → TARGETED REGRESSION → EXACT-SHA/RUNTIME PROOF → HANDOFF`.

## Guards

- One immutable `workPackageId` per agent session.
- Bursts of 8+ commits in 5 minutes require a `[WP:WP-...]` marker on every commit.
- Sensitive liveness/wake/watchdog/lease/council/supersession/registry changes require adjacent test/verification coverage.
- Agent events are evidence-typed: CHANGE→files, TEST/VERIFICATION→evidence, FINDING→findings, BLOCKER→blockers.
- Canonical Cell/Actions/supersession/runtime contracts are continuously locked and fail-closed.
- No new branch is introduced by this guard; `execution` remains the mutation path.
- Exact-SHA runtime evidence remains authoritative over ledger claims.

Historical schema-v1 ledger records remain readable and are not rewritten retroactively.
