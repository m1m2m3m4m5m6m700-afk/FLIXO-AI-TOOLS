# FINAL FLIXO CI — V5–V10

## Objective
Single execution owner per verification surface, reusable artifacts, balanced parallelism, fail-closed change classification, and SHA-bound evidence.

## Sequence
V5 Build Once + Artifact Graph
V6 Weighted Sharding
V7 Fail-Closed Change Intelligence
V8 Evidence Ledger + Coverage Accounting
V9 Architecture/Deduplication Contract
V10 Benchmark/SLO

## Non-negotiable invariants
- No silent security skip.
- No missing or skipped evidence can produce PASS.
- `expected === executed` for every gate.
- Every evidence record contains the exact Git SHA.
- Unknown changes and dependency/workflow changes force FULL certification.
- Diagnostic workflows are never merge gates.
