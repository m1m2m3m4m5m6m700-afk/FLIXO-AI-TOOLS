# Fast PR CI parallel execution

The merge path uses eight independent impact-aware diagnostic groups in parallel:

- core
- structure
- localization
- seo
- security
- artifact
- browser
- build

Each group emits SHA-bound evidence. The `CI` aggregate requires every group to produce valid PASS evidence before `Fast Contract Diagnostics` and `Canonical Verification Gate` can pass.

Deep G4 certification remains outside the PR merge path and continues to run on main/manual workflows.
