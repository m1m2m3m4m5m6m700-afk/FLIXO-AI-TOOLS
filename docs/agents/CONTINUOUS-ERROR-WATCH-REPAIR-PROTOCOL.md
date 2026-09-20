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
