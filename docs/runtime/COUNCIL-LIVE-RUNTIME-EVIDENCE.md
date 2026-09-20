# Council live-runtime evidence contract

The repository contract deliberately separates source-controlled RPC evidence from live Supabase runtime evidence.

SOURCE_VERIFIED means the authoritative SQL, security boundary, exact-SHA/session invariants, and validators exist in Git and pass CI.

LIVE_VERIFIED is a separate assertion. It must come from an actual runtime readback performed against the deployed Council runtime and must bind the readback to the exact execution SHA. Required fields:

- state: LIVE_VERIFIED
- verifiedSha: 40-hex execution SHA
- verifiedAt: ISO-8601 timestamp
- provider: the real production provider
- verifier: non-empty verifier identity
- evidenceRef: immutable runtime-readback reference

The promotion gate consumes this evidence separately and fails closed when the file is absent, stale, malformed, or not LIVE_VERIFIED.

No source-controlled declaration may be used to claim that the live database was migrated or is healthy without an actual runtime readback. The current repository therefore remains non-certifiable until this evidence is produced by an authorized runtime verification process.
