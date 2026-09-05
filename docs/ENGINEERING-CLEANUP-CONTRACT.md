# FLIXO Engineering Cleanup Contract

## Objective

Keep FLIXO correct, reproducible, evidenced, and release-safe while removing legacy verification/build complexity that has no independent proof boundary.

## Ownership rule

`ONE SURFACE -> ONE PROOF OWNER -> ONE AUTHORITATIVE TEST BOUNDARY`

A workflow, validator, report, or build chain is retained only when it has an independent contract, unique proof boundary, or required dependency that has not yet been migrated.

## Classification

- AUTHORITATIVE: owns a required proof and remains active.
- UNIQUE-PROOF: retained because no equivalent proof exists.
- DUPLICATE: removed after coverage equivalence is established.
- LEGACY-DEPENDENCY: migrated away from consumers before deletion.
- UNPROVEN: never treated as release evidence until its identity and scope are established.

## Legacy migration invariant

No legacy chain may be deleted merely because a newer implementation exists. Its consumers must first be mapped, its proof boundary identified, and an authoritative replacement must be proven on the same contract surface.

## Release invariant

A release is not clean because CI is green. Release certification requires exact SHA, current evidence, complete required coverage, valid artifacts, resolved persistent root causes, and no unowned verification dependency.

## Cleanup sequence

`Inventory -> Dependency Graph -> Ownership -> Root Cause -> Minimal Consolidation -> Fresh Verification -> Evidence -> Red Team`

Any failure discovered during cleanup reopens verification and receives a root-cause classification before further consolidation.
