# FLIXO CI Rebuild — Architecture Freeze

## Baseline

- Baseline `main` SHA: `f8c99b41d0e66b3bf958bcf24ad5499b7722b2db`
- Rebuild branch: `ci/rebuild-foundation`
- Open G3 PR at discovery: `#526` (`1d1ab8151b53b19be5f84535bfd07fc4c1f5dfbe`)

## Hard Safety Locks

The following are forbidden during CI-0 through CI-8:

1. Changing branch protection or required checks.
2. Deleting any legacy workflow.
3. Rewriting `main`.
4. Changing production deployment configuration.
5. Changing DNS, production domain, or production secrets.
6. Turning a Preview deployment URL into the production-origin authority.
7. Weakening an existing assertion or adding an allowlist to obtain GREEN.
8. Replacing legacy authority before contract-level parity is proven.
9. Introducing a second CI authority.
10. Hiding legacy failures behind the new reporting layer.

## Migration Rule

Legacy remains authoritative until each migrated contract has:

`semantic parity + scope parity + coverage parity + evidence parity + release-safety proof`

## Rollback Rule

Every CI migration PR must be independently revertible. A migration PR must not require a simultaneous branch-protection mutation to recover the old authority.

## Production Origin Rule

Production origin is configuration, not a workflow default. CI test origins and Preview deployment URLs must never become production canonical identity.

## Phase-Exit Rule

No phase may advance when implementation, verification, evidence, acceptance criteria, or safety locks are incomplete.
