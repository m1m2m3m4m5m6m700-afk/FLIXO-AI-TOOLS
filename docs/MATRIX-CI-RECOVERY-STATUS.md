# Matrix + CI Recovery Status

Recovery branch: `agent/ci-matrix/full-recovery`

The branch is an isolated writer scope intended to repair the Matrix/CI orchestration while preserving the canonical Matrix First certification authority.

Observed inherited Matrix agent scope was released before this recovery session. Its Matrix changes are treated as prior input, not concurrent ownership.

Current recovery focus:

- canonical Matrix First orchestration and certification
- signed `_flixo_matrix_plan.json` provenance
- collision-safe native Playwright test identity
- exact planned-vs-observed suite/test equality
- exact-head evidence integrity
- CI barrier coherence
- ancestry-bound agent claim lifecycle

Release remains blocked until fresh exact-head CI and Matrix evidence exist and all required gates pass.
