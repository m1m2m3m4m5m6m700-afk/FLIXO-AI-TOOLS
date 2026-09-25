# Integration-blocker retirement plan

STATUS: RETIREMENT-IN-PROGRESS
OWNER: Security, i18n & Integration Agent
CANONICAL LANE: execution → main
BASELINE_SHA: 6c678d2f60863b03db9e58a9e1aae96fe38c75bf

## Root cause

The former blocker text was tied to historical PR #474 / S4 / V5–V10 state. That dependency is stale and must not remain a release prerequisite. The certification graph must bind to the current exact execution SHA instead of a historical pull request.

## Retirement sequence

1. Replace the historical PR #474 prerequisite with a current exact-SHA integration baseline on execution.
2. Require fresh canonical CI evidence for the same SHA: build, typecheck, lint, dependency/lock checks, G1 SEO, G4 oracle/localization, security baseline, and the affected browser matrix.
3. Require the security Red-Team triad to consume the exact SHA and preserve started-run evidence without cancellation.
4. Verify that all localized public tool routes expose canonical metadata, canonical URL, complete hreflang, localized H1/visible UI, and social media image metadata.
5. Verify MS/UK locale identity and complete authoritative tool SEO coverage across every ready tool.
6. Verify npm ci lock resolution, zero dependency vulnerabilities in the canonical dependency gate, and reviewed Dependabot configuration on the default branch.
7. Remove the historical blocker prerequisite only after the fresh evidence set is exact-SHA complete and no unresolved integration blocker remains.

## Closure gate

The blocker is CLOSED only when a single fresh execution SHA has: canonical CI GREEN; security baseline GREEN; Red-Team evidence bound to the same SHA; G1/G4/i18n/dependency gates GREEN; deployment artifacts generated from that SHA; and no historical PR dependency referenced by any release/certification contract.

Until those conditions are evidenced, this file is an active retirement record and must not be interpreted as a deployment certification.
