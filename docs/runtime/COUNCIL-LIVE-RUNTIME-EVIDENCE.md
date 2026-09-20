# Council live-runtime evidence contract

Source-controlled RPC evidence and live runtime evidence are separate trust domains.

SOURCE_VERIFIED means the authoritative SQL, security boundary, exact-SHA/session invariants, and validators exist in Git and pass CI.

LIVE_VERIFIED must come from the dedicated protected workflow: FLIXO Council Live Runtime Verification.

The workflow is manual, uses the protected environment flixo-live-runtime-verification, performs only read-only runtime probes against the live Supabase project, binds the result to the requested execution SHA, and publishes an immutable GitHub Actions artifact.

Required evidence fields:
- state: LIVE_VERIFIED
- verifiedSha: the exact 40-hex execution SHA
- verifiedAt: ISO-8601 timestamp
- provider: supabase
- verifier: workflow/run identity
- evidenceRef: immutable workflow/run reference

The promotion gate downloads the successful live-runtime artifact for the exact SHA and validates it before certification.

A source-controlled JSON declaration cannot substitute for the live artifact. The live workflow requires protected environment secrets and therefore cannot be satisfied by changing files inside the pull request.