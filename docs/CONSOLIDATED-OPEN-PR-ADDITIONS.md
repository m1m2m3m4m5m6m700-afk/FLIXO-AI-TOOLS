# Consolidated Open-PR Additions

Baseline: `main @ fcf5f7be198f4b6b480c555deaf1253968a05fd1`

This consolidation carries only additions that remain materially unique on the current main baseline.

Included:
- PR #634: critical mutation registry and executable mutation harness.
- PR #648: Phase A negative-control integration proof.

Already present on current main and therefore not duplicated:
- PR #636 exact-SHA runtime evidence binding.
- PR #641 verification checkpoint producer.
- PR #610 authoritative localized H1 ownership.
- PR #632 shared runtime/tool-chain localization closure.
- PR #653 canonical logo delivery and runtime-console evidence serialization.

Excluded as historical, superseded, duplicate, diagnostic-only, or unrelated dependency work:
- PR #598/#599 matrix/cooperation rewrites whose current-main semantics are already represented or superseded.
- PR #600/#601/#603 legacy image-only migration work superseded by current main.
- PR #604/#605 legacy CI/fixture restructuring superseded by current canonical runner.
- PR #612 autonomous agent execution-plane expansion; not part of the current minimal consolidation target.
- PR #646 governance closure evidence remains a separate external-permission scope.
- Dependabot-only PRs are intentionally excluded from the functional consolidation.

No new certification authority or parallel blocking gate is introduced by this consolidation.
