# CI Rebuild Rollback Plan

## Immutable Baseline

`main` baseline SHA: `f8c99b41d0e66b3bf958bcf24ad5499b7722b2db`

## Rebuild Isolation

All rebuild work is isolated to `ci/rebuild-foundation` until reviewed and promoted through a pull request.

## Rollback Triggers

Rollback or stop migration when any of the following occurs:

- Main branch is modified outside the normal PR merge path.
- Existing authoritative CI behavior is weakened or silently bypassed.
- New evaluator disagrees with legacy authority and the discrepancy is unexplained.
- Required verification coverage decreases without a proven redundancy argument.
- Branch protection becomes ambiguous or required checks become orphaned.
- Production deployment, origin, DNS, or secrets are changed unintentionally.
- Checkpoint fingerprints cannot prove result validity.
- Impact analysis can produce a false-negative affected scope.

## Recovery

1. Stop promotion of the current migration phase.
2. Keep legacy CI authoritative.
3. Revert the migration PR if it has been merged and the replacement cannot be safely isolated.
4. Do not repair the rollback by weakening a contract.
5. Re-run the affected baseline and record the new evidence.

## Forbidden Recovery Shortcut

Never recover by disabling required checks, deleting failing tests, adding blanket allowlists, or changing production-origin semantics.
