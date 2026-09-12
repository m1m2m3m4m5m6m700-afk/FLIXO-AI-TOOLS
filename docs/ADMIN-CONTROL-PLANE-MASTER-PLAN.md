# FLIXO Admin Control Plane — Master Execution Plan

Status: ACTIVE PLAN / execution-tracked
Baseline: main @ fcf5f7be198f4b6b480c555deaf1253968a05fd1
Foundation branch: feature/admin-control-plane-foundation
Foundation PR: #658

## 0. Mission

Build an exceptional Admin Control Plane for FLIXO that is an operational truth, governance, security, and controlled-execution system—not a decorative dashboard and not a resurrection of the retired legacy Admin.

Primary principles:
- Zero False Green.
- Exact-SHA provenance.
- Evidence First.
- Fail closed.
- Discovery Before Proposal.
- Maximum Proof × Minimum Process.
- One source of truth per capability.
- No LLM-direct production execution.
- Optimize the current architecture before adding complexity.
- Every production claim must be reproducible from current evidence.

## 1. Non-negotiable architectural boundary

Current FLIXO is a Vite + React + TypeScript + TanStack Router application. The current route tree contains public/localized routes and no Admin route. The current package has no server/auth/database framework suitable for blindly restoring the historical Admin.

Therefore:
- Do NOT restore legacy Admin routes wholesale.
- Do NOT restore legacy Admin localStorage/session behavior.
- Do NOT add a second database stack without proven need.
- Do NOT put credentials or authorization secrets in the browser bundle.
- Do NOT expose a client-only Admin pretending to be secure.
- Do NOT create fake production metrics or fake evidence.
- Do NOT add bespoke test suites for every Admin page.
- Do NOT allow an LLM to bypass authorization, policy, approval, or evidence.

The Admin must sit above current system contracts through a real server-side boundary.

## 2. Target architecture

Browser Admin UI
  -> Server/Admin API Boundary
  -> Identity + HTTP-only Session
  -> Capability Authorization
  -> Policy Engine
  -> Domain/Data Adapters
  -> Existing FLIXO contracts and persistence
  -> Evidence Ledger
  -> Audit Trail
  -> Controlled Execution / Rollback

Observation path:
System -> source -> exact SHA/version -> evaluator -> evidence -> verdict -> Admin Truth Center.

Execution path:
Admin intent -> deterministic command -> authorization -> policy -> preview -> approval when required -> execution -> verification -> evidence -> audit.

## 3. Product modules

### P0 — Command Center
Single operational entry point. Shows verified production state, active incidents, blocked operations, pending approvals, current SHA, CI/security state, and evidence freshness.

### P0 — Truth Center
Every important claim is represented as Claim -> Source -> SHA/version -> Check -> Evidence -> Timestamp -> Verdict.

### P0 — Security Center
Identity, sessions, roles, capabilities, policy decisions, security events, login/rate-limit state, and audit visibility.

### P0 — Contract Center
Contracts, owners, dependencies, evaluators, required evidence, status, and dependency closure.

### P0 — Operations Center
Deployments, CI runs, jobs, queues, API operations, background work, failures, and operational timelines.

### P0 — Incident Center
Incident classification, first failure, root cause, impact, related changes, evidence, blocker, remediation, and closure.

### P1 — Change Center
PR/commit/change provenance, affected contracts, tests, security impact, risk, approval, verification, and rollback metadata.

### P1 — Approval Center
Risk-based approval workflow for sensitive and destructive operations.

### P1 — Evidence Ledger
Immutable-style append-only evidence model with actor, action, SHA, environment, input, output, verification, timestamp, and artifact references.

### P1 — Truth Graph
Visual dependency/provenance graph connecting production -> release -> SHA -> contracts -> checks -> evidence -> verdict.

### P2 — Controlled AI Assistant
Read/analyze/recommend only through deterministic planners and authorized capabilities. Never direct production execution.

## 4. Capability model

Initial capabilities:
- admin.read
- truth.read
- evidence.read
- security.read
- contracts.read
- operations.read
- incidents.manage
- changes.read
- approvals.review
- users.manage
- deployments.preview
- deployments.execute
- system.rollback

Capabilities must be explicit, typed, server-enforced, auditable, and deny-by-default.

Suggested roles:
- OWNER: full governance authority.
- ADMIN: operational administration within policy.
- OPERATOR: approved operational execution.
- ANALYST: read-only operational/truth access.
- AUDITOR: evidence/audit read access.

Role is a grouping mechanism; capability is the actual authorization unit.

## 5. Security contract

Required before any real write/execution capability:
1. Server-side identity verification.
2. HTTP-only secure session.
3. Explicit role/capability authorization on the server.
4. CSRF protection for state-changing browser requests where applicable.
5. Login/session rate limiting.
6. No secrets in client bundles.
7. No sensitive data leakage in logs.
8. Audit record for privileged actions.
9. Fail-closed behavior on missing configuration or identity.
10. Explicit session expiry/revocation behavior.

## 6. Truth and evidence contract

Every production-facing Admin claim must carry:
- assertionId / claimId
- exact SHA or authoritative version identifier
- source
- evaluator/check
- environment
- evidenceId
- timestamp
- status/verdict
- freshness/age

Allowed truth states:
- VERIFIED
- FAILED
- BLOCKED
- UNAVAILABLE
- STALE
- UNKNOWN

Never convert UNKNOWN, STALE, or UNAVAILABLE into GREEN.

## 7. Execution safety model

Operations are classified:

READ -> direct if authorized.
LOW-RISK WRITE -> policy-controlled execution.
HIGH-RISK WRITE -> preview + approval + execution + evidence.
DESTRUCTIVE -> explicit confirmation + approval + rollback plan + audit.
PRODUCTION CHANGE -> exact target + policy + approval where required + post-change verification.

Every execution must have:
- deterministic command/capability
- authorization decision
- policy decision
- input validation
- preview where risk requires it
- execution result
- post-change verification
- evidence
- audit
- rollback metadata

## 8. AI safety contract

AI may:
- summarize evidence
- correlate incidents
- explain failures
- propose deterministic next actions
- navigate the Truth Graph

AI may not:
- invent evidence
- certify GREEN
- bypass policy
- bypass approval
- execute arbitrary code
- directly mutate production
- grant itself capabilities

Flow:
Chat -> Intent -> Deterministic Planner -> Authorized Capability -> Policy -> Preview -> Approval -> Execution -> Evidence.

## 9. Delivery phases

### Phase 0 — Foundation [DONE in PR #658]
- typed capability model
- truth/evidence model
- fail-closed unavailable state
- private/noindex Admin surface foundation
- module map
- architecture contract

Exit: foundation code exists, but no Production Admin claim.

### Phase 1 — Server Boundary [NEXT / BLOCKING]
Build the minimum real server-side boundary compatible with the current deployment architecture.

Deliverables:
- Admin API boundary
- server-only secret handling
- identity contract
- session contract
- authorization middleware/policy boundary
- standard error contract
- request correlation IDs
- safe logging

Exit criteria:
- unauthenticated access denied
- invalid session denied
- unauthorized capability denied
- missing server configuration fails closed
- no server secrets shipped to browser
- exact-SHA test evidence

### Phase 2 — Real Persistence and Evidence
Use one proven persistence path. Do not create parallel stores without evidence.

Deliverables:
- Admin principals/roles/capabilities as needed
- audit events
- evidence records
- operational read models/adapters
- retention rules
- integrity/provenance fields

Exit criteria:
- write/read-back proof
- actor and exact target provenance
- audit completeness
- no fake metrics

### Phase 3 — Truth Center + Command Center
Deliver verified operational visibility.

Deliverables:
- system health aggregation
- CI/deployment state
- contract status
- evidence freshness
- command center
- truth claims
- drill-down to source/evidence

Exit criteria:
- every displayed production claim is traceable
- stale/missing evidence visibly blocked
- no false green

### Phase 4 — Security + Contract + Operations Centers
Deliver governance and operational control surfaces.

Exit criteria:
- authorization matrix proven
- contract ownership visible
- dependency closure correct
- incidents linked to root causes
- privileged actions audited

### Phase 5 — Controlled Execution
Introduce carefully bounded writes.

First operations should be low-risk and reversible. Then expand only from proven need.

Exit criteria:
- preview
- authorization
- policy
- approval where required
- execution
- verification
- evidence
- rollback

### Phase 6 — Change + Approval + Incident Centers
Unify change management, approvals, and incident response around the same provenance/evidence model.

### Phase 7 — Truth Graph
Build the visual provenance/dependency graph only after the underlying data contracts are proven.

### Phase 8 — Controlled AI Assistant
Add AI only after Truth, authorization, policy, evidence, and deterministic execution are stable.

### Phase 9 — Certification
Production Admin certification requires exact SHA, clean worktree, all required checks passing, fresh current evidence, security proof, authorization proof, persistence/read-back proof, browser proof, and post-change verification.

## 10. Test strategy

Use the existing verification architecture and extend shared contracts rather than creating page-by-page test duplication.

Required layers:
- static contract validation
- typecheck/lint/build
- server boundary unit/contract tests
- authorization matrix tests
- fail-closed tests
- evidence provenance tests
- persistence/read-back tests
- audit integrity tests
- API integration tests
- focused browser tests for critical Admin flows
- security scan
- production smoke/read-back evidence

Required negative tests include:
- missing auth
- expired session
- invalid session
- insufficient capability
- missing configuration
- stale evidence
- mismatched SHA
- failed verification
- attempted unauthorized write
- attempted destructive action without approval
- attempted AI direct execution

## 11. UX contract

Admin UI must be dense but legible. Every critical state should expose:
- what happened
- why it matters
- exact target
- current status
- evidence
- next safe action

Primary states must be visually distinct:
VERIFIED / FAILED / BLOCKED / UNAVAILABLE / STALE / UNKNOWN.

No decorative analytics without operational value.

## 12. Data ownership rules

One canonical owner per fact.

Admin must not duplicate:
- tool registry
- contract registry
- CI truth
- deployment truth
- production metrics

Admin consumes authoritative adapters and links back to source.

## 13. Historical Admin reuse rules

Historical successful contracts from PR #5, #21, #399, and #400 are reusable design evidence:
- server-only auth boundary
- HTTP-only sessions
- explicit roles/authorization
- fail-closed configuration
- CSRF/rate limiting
- real-data-only analytics
- auditability
- private/noindex Admin surface

PR #602 retirement is an architectural constraint: do not resurrect the old Admin graph wholesale.

## 14. Explicit exclusions

Not part of this plan unless separately activated:
- legacy Admin restoration
- localStorage auth
- second database stack
- bespoke test suite per page
- fake analytics
- unrestricted AI execution
- speculative microservices
- unnecessary queue infrastructure
- unnecessary framework migration
- new features unrelated to Admin control-plane value

## 15. Definition of Done

Admin is COMPLETE only when all of the following are true on one exact production candidate SHA:

[ ] Real server boundary exists.
[ ] Identity/session is proven.
[ ] Authorization is server-enforced and fail-closed.
[ ] Real persistence path is proven where required.
[ ] Evidence ledger is operational.
[ ] Truth Center is fully traceable.
[ ] Command Center uses authoritative data.
[ ] Security Center is operational.
[ ] Contract Center is operational.
[ ] Operations Center is operational.
[ ] Incident Center is operational.
[ ] Change Center is operational.
[ ] Approval Center is operational.
[ ] Truth Graph is backed by real provenance.
[ ] Controlled execution is deterministic and policy-bound.
[ ] Rollback is proven for applicable writes.
[ ] AI is bounded and cannot directly execute production.
[ ] Critical negative tests pass.
[ ] Security verification passes.
[ ] Browser verification passes.
[ ] Production smoke/read-back evidence passes.
[ ] Exact SHA matches all evidence.
[ ] Worktree is clean.
[ ] No stale evidence is used for certification.
[ ] No false-green path exists.

Only then:
ADMIN = COMPLETE / GREEN / STABLE

## 16. Execution discipline

For every phase:
1. Inspect actual repository state.
2. Establish contract provenance.
3. Define exact target.
4. Implement minimum necessary change.
5. Run focused negative/positive proof.
6. Reanalyze after change.
7. Capture exact-SHA evidence.
8. Merge only with fresh evidence.
9. Post-merge reverify production state.
10. Update this plan's status/checkpoints.

No phase is considered complete because code exists. Completion means behavior is proven on the exact SHA.

## 17. Persistent checkpoint

Current checkpoint:
- main: fcf5f7be198f4b6b480c555deaf1253968a05fd1
- foundation PR: #658
- foundation HEAD: b9854f89b3bc97a5d81119ea58e7e2b9e8ff9261
- Phase 0: IMPLEMENTED / awaiting required verification
- Phase 1: LOCKED until foundation is verified and server-boundary target is confirmed
- Production Admin: NOT COMPLETE

This document is the persistent execution roadmap. Update it after each material Admin phase, preserving exact SHA and evidence references. Never mark a phase complete without proof.
