# Red Team Test-System Teaching — 2026-09-25

## Work package
- Task: SECURITY-REDTEAM-TEST-SYSTEM-001
- Work package: WP-SECURITY-REDTEAM-TEST-SYSTEM-001
- Evidence entry SHA: 39b77b83238b30a405c71d2236bc9401f880842d
- Authority: READ_ONLY_TEST_SYSTEM_ADVERSARY
- Canonical GREEN authority: unchanged; Red Team cannot certify GREEN.

## Implemented
The existing Security Red-Team triad now contains an adversarial verifier phase in SECURITY-REDTEAM-1. It runs only in ephemeral temporary workspaces, binds all attacks to the exact target SHA, has no mutation/certification/green authority, and fails closed when any attack escapes.

## Attack corpus
- Exact-SHA requirement removal
- Workflow privilege escalation
- Third-branch policy drift
- Mutation-authority escalation
- Loss of immutable checkout credentials
- Forbidden branch-creation behavior
- Runtime exact-SHA mismatch
- False-GREEN evidence corruption

## Lessons
1. Adversarial output must remain outside frozen trust-state; merge only into immutable evidence/report data.
2. A branch-creation attack must exercise the production two-branch validator from an ephemeral git repository and inject the forbidden pattern into a production-scanned target.
3. Standalone supersession controllers must be validated as standalone controllers; never duplicate their implementation inside canonical ci.yml merely to satisfy a stale assertion.
4. Any execution SHA change invalidates every previous adversarial result.
5. GitHub Actions API rate limiting during stale-run cancellation is an external blocker. Retry within bounded limits, record explicit stale invalidation when supported, then remain fail-closed.

## Anti-lessons
- Never grant Red Team mutation, repair, promotion, certification, or GREEN authority.
- Never reuse superseded Red-Team artifacts as current proof.
- Never weaken Canonical CI to work around API rate limits.
- Never treat queued, cancelled, or incomplete Required CI as GREEN.

## Verification status
At recording time, the current execution SHA has new Required CI and Red-Team runs queued. Canonical GREEN is NOT PROVEN.
