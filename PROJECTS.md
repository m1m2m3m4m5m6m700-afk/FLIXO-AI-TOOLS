# FLIXO AI — Persistent Projects & Agent Work Map

**First work gate for every agent.** Read this file before implementation. It is the persistent cross-session task map.

`المهام.md` is the mandatory open-task gateway and must be read immediately after this file.

## CURRENT STATE

```text
BRANCH = main
ACTIVE TASK = ADMIN-006 → ACTIVE / BLOCKED BY EXTERNAL PRODUCTION VERIFICATION
ADMIN-003 = CLOSED / VERIFIED
ADMIN-004 = CLOSED / VERIFIED
ADMIN-005 = CLOSED / VERIFIED
ADMIN-005 CLOSURE SHA = 9bc587157a1fd598a54472c95ec11effc8f35ea7
ADMIN-005 CANONICAL CI RUN = 34800432764 (attempt 2)
ADMIN-006 CONTRACT = docs/contracts/ADMIN-006-PHASE-2-PERSISTENCE-EVIDENCE-CONTRACT.md
ADMIN-006 PROVENANCE = docs/ADMIN-PERSISTENCE-PROVENANCE.md
SUPABASE PROJECT = zrpsmgdrtwzrhkjwwujo / ACTIVE_HEALTHY
VERCEL PRODUCTION BINDING = NOT PROVEN / EXTERNAL VERIFICATION IN PROGRESS
PRODUCTION MUTATION = DISABLED
CURRENT MAIN SHA = 51048366abb4edf84bfa3a2be0162b11736ce4f2
CURRENT MAIN CI = SUCCESS (fresh push checks)
LATEST VERIFIED VERCEL DEPLOYMENT = AMe8LsopcLo2pETk9yrBVa9VSwsS
LATEST VERIFIED VERCEL SOURCE = c19c04a86a20599fced011a246fee6e39a8d437b (STALE)
LATEST VERCEL RESULT = READY WITH BUILD ERROR LINE FROM STALE SHA; NOT CLOSURE PROOF
```

## TASK QUEUE

| ID | Status | Next deterministic action |
|---|---|---|
| ADMIN-003 | CLOSED / VERIFIED | Preserve canonical read-only centers |
| ADMIN-004 | CLOSED / VERIFIED | Preserve fail-closed execution boundary |
| ADMIN-005 | CLOSED / VERIFIED | Preserve verified server boundary and browser-bundle security invariant |
| ADMIN-006 | ACTIVE / BLOCKED | Complete production exact-SHA identity and server write → read-back proof when canonical Vercel access is available; never weaken proof requirements |
| ADMIN-007 | LOCKED | Activate after ADMIN-006 |
| ADMIN-008 | LOCKED | Final production certification |
| BUILD-002 | CANDIDATE | Fresh artifact graph analysis |
| I18N-001 | CANDIDATE | Runtime ownership trace |
| TEST-001 | CANDIDATE | Ownership inventory |
| DEBT-001 | CANDIDATE | Fresh-failure/value review |
| TOOL-EXPANSION | CANDIDATE | Select smallest proven candidate |

## ADMIN-003

```text
CLOSED / VERIFIED
closure SHA = 80ae6d8501a77fefa2915946782038355e5be3ac
canonical CD run = 34796825957
```

## ADMIN-004

```text
CLOSED / VERIFIED
closure SHA = b036327855222f4c11db0cfc8a1657167e4231be
canonical test/certification run = 34798018758
execution remains fail-closed
production mutation = DISABLED
```

Contract:

```text
authentication
→ deterministic command/target
→ policy
→ preview
→ rollback requirement
→ approval when required
→ execution boundary
→ verification
→ evidence
→ audit
→ rollback proof
```

Verified implementation:

```text
execution-policy.ts  = non-preview writes DENY
execution-plan.ts    = PREVIEW_ONLY / enabled=false
execution-preview.ts = GET-only / no mutation
```

## ADMIN-005

```text
CLOSED / VERIFIED
base SHA = de07ac765159a4ba328b4d33d971b8d13db9d4c4
implementation SHA = 9bc587157a1fd598a54472c95ec11effc8f35ea7
closure SHA = 9bc587157a1fd598a54472c95ec11effc8f35ea7
canonical CI run = 34800432764 (attempt 2)
RCA = ADMIN-005-CLIENT-BUNDLE-BOUNDARY-001
```

Authoritative roadmap evidence:
`docs/ADMIN-CONTROL-PLANE-MASTER-PLAN.md`

Implemented causal repair:
`vite build → validate-build-chunk-boundaries.mjs → browser bundle security boundary`

The validator now rejects emitted browser JavaScript containing privileged server-side Admin markers (`ADMIN_SESSION_SECRET`, `authorizeAdminRequest`, `createHmac`, `signAdminSession`) while permitting ordinary browser API paths such as `/api/admin/centers`.

Fresh exact-SHA proof:
`34800432764` completed successfully on `main @ 9bc587157a1fd598a54472c95ec11effc8f35ea7`, including Static + Build, Browser FAST/DEEP evidence, Certification, and CI/CD Trust Layer. The previous Firefox DEEP evidence-upload failure was retried as the affected job only and then passed.

Phase 1 exit conditions proven on the closure SHA:
- unauthenticated access denied
- invalid/tampered/expired sessions denied
- unauthorized capability denied
- missing server configuration fails closed
- no privileged server boundary/secret markers shipped to browser bundle
- exact-SHA certification evidence present

Current roadmap execution posture:
`Controlled Execution = LOCKED`

## ADMIN-006

```text
ACTIVE / BLOCKED BY EXTERNAL PRODUCTION VERIFICATION
Contract = docs/contracts/ADMIN-006-PHASE-2-PERSISTENCE-EVIDENCE-CONTRACT.md
Contract version = v1.0
Provenance = docs/ADMIN-PERSISTENCE-PROVENANCE.md
Supabase project ref = zrpsmgdrtwzrhkjwwujo
Supabase status = ACTIVE_HEALTHY
Existing tables = public.flix_events, public.flix_admin_sessions
Admin substrate = public.flix_admin_evidence, public.flix_admin_audit_events
Migration = supabase/migrations/20260914040000_admin_006_persistence_evidence.sql
Server adapter = api/admin/persistence.ts
Targeted regression = scripts/test-admin-persistence.mjs
Vercel documented project = prj_FdFbUWMAZepEfvwhttAiLcYJqY0d
Vercel project access = NOT PROVEN / EXTERNAL BLOCKER
Latest certified CI = 34810495439 SUCCESS on 51048366abb4edf84bfa3a2be0162b11736ce4f2
Latest Vercel deployment evidence = AMe8LsopcLo2pETk9yrBVa9VSwsS
Latest Vercel deployment source = c19c04a86a20599fced011a246fee6e39a8d437b (STALE)
```

Repository implementation for the Phase 2 persistence/evidence substrate is complete. The remaining closure gate is authoritative production verification through the documented Vercel deployment: exact production identity and server write → read-back proof. External provider quota/access failures are blockers and must not be converted into GREEN.

The latest manual Vercel deployment is Ready but was built from stale `main @ c19c04a86a20599fced011a246fee6e39a8d437b`, not the current `main @ 51048366abb4edf84bfa3a2be0162b11736ce4f2`. Its deploy log reports `api/admin/boundary.ts(80,9): error TS18048: 'payload.exp' is possibly 'undefined'`, which is absent from the current main source after the narrowing repair. Therefore this deployment is explicitly non-closure evidence.

A direct substrate round-trip was also verified against Supabase using the current main SHA `4096d6681643c4da3bcf8ca47c5f2b26381be2c9`; test rows were removed after verification. This is not a substitute for production deployment proof.

## GOVERNANCE

Bounded single-owner work may execute directly on `main`. Use `execution` only for materially risky, broad, conflict-prone, architectural, or production-sensitive isolation. Exact-SHA, regression, authorization, rollback, evidence, and certification requirements remain mandatory.

## DELETION

A task may leave the open queue only after merge-to-main, exact-SHA proof, targeted tests, required CI/certification, invariant proof, no dependent repair, closure evidence, history update, and next-task update.

## EVIDENCE

`EXACT SHA ∧ CLEAN WORKTREE ∧ REQUIRED TEST PASS ∧ FRESH CURRENT EVIDENCE`

No GREEN outside these conditions.
