# FLIXO Continuous Error Watch & Repair

DO NOT CLOSE UNTIL GREEN IS PROVEN

GREEN != STOP

The continuous loop is:

OBSERVE → EXACT SHA → REQUIRED CI → CLASSIFY → REPAIR OR BLOCK EXTERNAL → TARGETED REGRESSION → CANONICAL GREEN → CONTINUE WATCHING

Every cycle records execution SHA, main SHA, CI/check state, new errors, root-cause status, repair target/action, verification state, external blockers, and final status.

The Task Agent remains the direct repair owner. The watcher may dispatch the existing Auto-Repair workflow only for actionable internal failures. It never modifies main, creates a third branch, weakens security/certification gates, or converts an external provider failure into a source-code repair.

Vercel failures, provider rate limits, and provider-side security-model failures are BLOCKED_EXTERNAL. Security remains blocking.

A cycle is GREEN only after exact-head required CI, security, and certification evidence are green with no unresolved external blocker. Merge remains the canonical execution → main gate, followed by independent main identity verification.

The watcher runs every 15 minutes and after relevant CI workflow completions. GREEN does not disable future monitoring.

## Error-only mutation boundary

The repair protocol is **ERROR_ONLY**: an automatic repair may mutate only the exact source file identified as the diagnosed causal failure location. It must not broaden the patch to adjacent files, repository-wide cleanup, or the test suite.

- failureLocation == selectedFile
- changedPaths must contain exactly one path, equal to failureLocation
- test files and test suites are never mutation targets for automatic error repair
- tests remain verification evidence: reproduce the RED, apply the causal source repair, run targeted regression, then resume the required verification
- changing a test to remove, skip, weaken, or reinterpret the failing condition is a protocol violation and must fail closed

This boundary is enforced by scripts/ci/repair-protocol.mjs::validateErrorOnlyMutation() and consumed by scripts/ci/auto-repair-engine.mjs. The enforcement test is part of scripts/ci/test-repair-protocol.mjs, which is already wired into the canonical CI contract.

## Repair teaching loop

Repeated REDs are training evidence, not permission for identical retries.

For a repeated failure fingerprint the repair plane MUST:

1. recover prior attempts from persistent memory, action history, and historical snapshots;
2. identify strategies, rules, and approaches already tried;
3. mark failed or reverted approaches as `doNotRepeat`;
4. select an unused repair strategy before another mutation;
5. after the teaching threshold is reached, require a materially new hypothesis and new evidence rather than stopping the repair loop;
6. record the new strategy, result, exact SHA evidence, and verification outcome for the next cycle.

The teaching state is advisory to mutation authority but mandatory for repair planning. It never grants certification authority. A repeated failure must not be converted into a new test merely to make the system appear green; source repair, infrastructure diagnosis, or an explicit external block remains the required disposition.
