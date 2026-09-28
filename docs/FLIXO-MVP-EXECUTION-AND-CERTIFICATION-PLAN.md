# FLIXO — CODEX EXECUTION MASTER PLAN
## Exact-SHA / Gap-Driven / Fail-Closed / Red-Team Verifiable

STATUS: ACTIVE / EXECUTABLE
REPOSITORY: m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS
PRIMARY EXECUTION BRANCH: execution
INTEGRATION PATH: execution -> main

## 0. CODEX OPERATING CONTRACT

You are the repository execution agent for FLIXO. Execute the plan; do not merely describe it.

ABSOLUTE RULES:
1. Never write directly to main.
2. All implementation mutations occur on execution only.
3. Never claim PASS, GREEN, VERIFIED, CERTIFIED, or RELEASE VERIFIED from stale evidence.
4. skipped, cancelled, neutral, pending, missing, or stale checks are NOT success.
5. Never weaken tests to make an implementation pass.
6. Never bypass an execution gate, verifier, registry, security control, or required check.
7. Never create a second canonical registry or second executor authority.
8. Never create a parallel runtime source of truth.
9. Never expand MVP scope merely because additional code exists.
10. Never perform unrelated refactoring inside a scoped prompt.
11. Any mutation creates a new SHA and invalidates prior SHA-specific evidence.
12. If a requirement is already proven on the CURRENT exact SHA, do not mutate it again; record PASS and continue.
13. If a real GAP exists, implement only the minimum required change within the current prompt.
14. If a blocker is external or outside scope, document it precisely; never fabricate success.
15. FAIL CLOSED whenever identity, authorization, privacy, verification, or required evidence cannot be established.
16. Do not stop merely because a GAP was found. Fix it when it is within scope, then verify.
17. Do not request routine confirmation; human owner authorization for this execution workflow is already established.
18. Human authorization never permits direct main writes or governance bypasses.

MANDATORY LOOP:
INSPECT CURRENT EXACT SHA -> CLASSIFY PASS/GAP/BLOCKER -> MUTATE execution ONLY IF GAP -> VERIFY -> RECORD NEW SHA/EVIDENCE -> INVALIDATE OLD EVIDENCE -> CONTINUE.

## 1. FINAL OBJECTIVE

Produce one release candidate lineage that proves:
- Agent Guided Workflow end-to-end.
- Independent Manual Standalone Workflow.
- Browser/Worker-local MVP file processing.
- No raw user File/Blob bytes sent to provider endpoints or backend processing.
- Exactly one canonical capability/tool registry.
- Exactly one canonical execution gate.
- Exactly one executor authority.
- LLM/provider is reasoning/proposal only, never execution authority.
- Verifiable output contracts and verifiers.
- Deterministic safe fallback for ambiguity, unsupported input, malformed output, or provider failure.
- Resource and security bounds.
- English and Arabic acceptance coverage.
- Clean-clone Red Team PASS.
- Required CI checks on the exact candidate SHA.
- Production/deployment identity proof when applicable.
- Certification only when all evidence belongs to the same candidate lineage.

## 2. ORDER OF EXECUTION

01 -> 02 -> 03 -> 04 -> 05 -> 06 -> 07 -> 08 -> 09 -> 10 -> 11 -> 12 -> 13 -> 14 -> 15 -> 16 -> 17 -> 18 -> 19 -> 20

A prompt may be mutation-free if its requirement is already proven on the CURRENT exact SHA. Inspect first; never replay historical work blindly.

# PROMPT 01 — EXACT-SHA STATE RECONCILIATION
ROLE: State Reconciliation Agent.
SCOPE: Read-only. No code mutation.
Resolve current main SHA, execution SHA, PR head/base, all required checks, current evidence, stale evidence, lineage mismatches, and blockers.
OUTPUT:
CURRENT_MAIN_SHA=
CURRENT_EXECUTION_SHA=
PR_HEAD_SHA=
PR_BASE_SHA=
REQUIRED_CHECKS=
CHECK_STATUS=
BLOCKERS=
STALE_EVIDENCE=
NEXT_PROMPT=
Do not declare GREEN or Certification.
EXIT: reconciliation complete or precise BLOCKER.

# PROMPT 02 — CANONICAL MVP SCOPE CLOSURE
ROLE: MVP Scope Authority Agent.
Inspect the canonical registry, tests, GPT, AGENTS.md, docs, README, package/config, release documentation, and actual runtime implementations.
Current documented candidates are:
- background-remover
- image-upscaler
- image-cropper
- image-compressor
- image-converter
- image-effects
- video-trimmer
- video-cropper
- video-resizer
- video-compressor
Do not assume this list is correct. Prove each capability as EXECUTABLE, READY, LOCAL, BROWSER_COMPATIBLE, VERIFIER_BACKED, and OUTPUT_CONTRACT_BACKED.
Create/update ONE Scope Decision Record. Align the canonical registry, tests, GPT, AGENTS/docs, release checklist, and add a CI contradiction test preventing multiple conflicting MVP definitions.
Never create another registry. Never expand scope without evidence. Never remove a runtime dependency without dependency proof.
VERIFY: typecheck + tests + scope contradiction test + build.
EXIT: one canonical MVP scope or BLOCKER.

# PROMPT 03 — REGISTRY → GATE → EXECUTOR → VERIFIER AUDIT
ROLE: Execution Contract Auditor.
For every declared MVP capability prove:
Canonical Registry -> Execution Gate -> Canonical Executor -> Verifier -> Output Contract -> Artifact.
Verify, where applicable: EXECUTABLE, READY, LOCAL, network=false, browser/browser-worker execution mode, executorId, outputContractId, parameterSchema, verifier, safetyLimits.
Search for Agent Editor shortcuts, direct executor calls, provider-controlled execution, alternate execution authority, and registry bypasses.
If a bypass exists, identify exact path, repair it through canonical architecture, and add regression coverage.
FORBIDDEN: second registry, second executor authority, execution-gate bypass, fake verifier, test weakening.
EXIT: every MVP capability has a canonical execution path or BLOCKER.

# PROMPT 04 — AGENT + MANUAL WORKFLOW E2E CLOSURE
ROLE: Workflow E2E Agent.
Prove Agent path:
Upload -> Natural Language -> Intent -> Parameters -> Plan -> Canonical Capability -> Execution Gate -> Executor -> Verifier -> Result.
Prove Manual path:
Browse Tools -> Tool -> File Input -> Execute -> Output.
Test valid image request, Arabic, English, compound request, ambiguity, unsupported operation, execution failure, manual fallback, and direct manual usage.
Provider failure or malformed provider output MUST NOT cause unverified execution.
Allowed terminal states: deterministic local plan, manual fallback, explicit failure.
Manual workflow MUST NOT depend on Agent.
Run browser/E2E against the exact SHA. UI visibility is insufficient; prove execution and output verification.
EXIT: both workflows proven or BLOCKER.

# PROMPT 05 — PROMPT / PROVIDER TRUST BOUNDARY
ROLE: Trust Boundary Security Agent.
Enforce: System Prompt = trusted policy/instructions; Assistant Context = task/conversation state; Untrusted Content = data only.
Test prompt injection, malicious layer labels, malformed provider response, malformed tool call, invalid parameters, unauthorized capability attempts, and failover context contamination.
Prove LLM = reasoning/proposal only. It must not possess raw File/Blob bytes, registry authority, executor authority, or verifier authority.
Repair violations at the canonical boundary and add regression coverage.
EXIT: trust boundary proven or BLOCKER.

# PROMPT 06 — BROWSER-LOCAL MEDIA EXECUTION
ROLE: Local Media Execution Agent.
Prove: File -> Decode -> Bounded Processing -> Worker/Local Executor -> Blob -> Verifier -> Artifact.
Verify/enforce maximum file size, maximum pixels/dimensions, timeout, AbortSignal, worker lifetime, output size limit, MIME validation, signature validation, and dimensions validation.
Use Web Workers where processing can block the UI, especially effects/video.
Prove operationally that raw file/image bytes never reach provider endpoints.
Test resource exhaustion, abort, and invalid output. Do not create a backend file-processing alternative.
EXIT: local execution, bounds, and privacy proven or BLOCKER.

# PROMPT 07 — VERSIONED ACCEPTANCE CORPUS
ROLE: Acceptance/Test Corpus Agent.
Cover compression, conversion, upscale, crop, effects, and background removal in Arabic and English.
Also cover compound commands, parameter extraction, ambiguity, conflicting parameters, malformed parameters, unsupported formats, unsupported operations, and oversized dimensions.
Effects MUST include Arabic/English regression cases for contrast, brightness, saturation, grayscale, compound effects, and negative/ambiguous requests.
Negative cases MUST resolve to null, fallback, or explicit error. Never guess.
All changes MUST flow through the canonical planner/capability layer.
EXIT: versioned corpus connected to canonical behavior or BLOCKER.

# PROMPT 08 — OUTPUT + VISUAL GOAL VERIFICATION
ROLE: Verification Agent.
Upgrade verification beyond output existence.
Verify MIME, extension, filename, signature, size, dimensions, and video metadata where applicable.
Add measurable visual/semantic verification for resize geometry, crop geometry, grayscale, brightness, contrast, saturation, and meaningful effects change.
output.size > 0 is not sufficient when a stronger property is measurable.
Add regression tests for every verifier. A verifier MUST NOT return success without evidence.
EXIT: output and visual verification proven or BLOCKER.

# PROMPT 09 — COVERAGE CLOSURE
ROLE: Coverage Agent.
Start from the exact current SHA.
Verify meaningful coverage of Agent Editor, provider router, adapters, agent runtime, local executor, media worker, security parsing, failover, output verification, browser-critical paths, and coverage generation.
Do not add superficial tests merely to increase a percentage.
For Codecov inspect policy/workflow. If tokenless upload is intentionally supported, document it. Otherwise configure the authorized secret.
FORBIDDEN: missing token treated as success, ignored upload failure, removed protection, || true, skipped coverage.
After any mutation regenerate coverage on the new SHA.
EXIT: real current coverage evidence or BLOCKER.

# PROMPT 10 — SECURITY CLOSURE
ROLE: Security Hardening Agent.
Audit input size, request limits, parameter schema, provider URL allowlist, provider timeout/response limits, SSE correctness, credential encryption, secret isolation, CSP, Permissions Policy, security headers, workflow permissions, action SHA pinning, worker bounds, and output limits.
Run CodeQL, dependency/security audit, and secret scanning.
Every failure must be real, classified, traceable, and fixed or explicitly documented as a blocker.
No masking. No bypass.
EXIT: security closure proven or BLOCKER.

# PROMPT 11 — CI / WORKFLOW SIMPLIFICATION
ROLE: CI Architecture Agent.
Inventory and classify workflows as verify, browser, security, coverage, deploy, repair-only, or release.
Detect duplicate execution, duplicate certification, duplicate registry logic, duplicate repair, obsolete swarm logic, self-trigger loops, and stale SHA assumptions.
Do not delete a workflow until runtime and required-check dependencies are proven absent.
For every workflow mutation: inspect exact SHA, inspect dependencies, mutate execution only, run affected checks, run canonical CI, and prove no required check disappeared.
Goal: reduce unnecessary complexity without reducing evidence.
EXIT: coherent workflow graph or BLOCKER.

# PROMPT 12 — MAIN GOVERNANCE HARDENING
ROLE: Repository Governance Auditor.
Inspect actual GitHub rulesets. Verify protected main, no direct push, required approving review, Code Owner review where required, strict required checks, stale-review policy, PR source restrictions, and merge queue where applicable.
Never mutate main directly.
If permissions prevent a change, report the limitation. Never fabricate PASS.
OUTPUT: CURRENT_POLICY / REQUIRED_POLICY / GAP / SAFE_MUTATION / VERIFICATION.
EXIT: governance evidence or BLOCKER.

# PROMPT 13 — EVIDENCE-BASED REPOSITORY HYGIENE
ROLE: Scoped Repository Hygiene Agent.
Inspect dead code, obsolete docs, duplicate contracts, stale certification claims, old registries, mock executors, obsolete swarm artifacts, inconsistent FLIXO naming, obsolete product names, and duplicate configuration.
For every deletion prove no runtime dependency exists.
Do not perform broad refactoring.
After cleanup run tests, typecheck, lint, build, and browser smoke.
Documentation claims must reference current exact SHA or be policy/instructions rather than certification claims.
EXIT: cleanup without regression or BLOCKER.

# PROMPT 14 — DOCUMENTATION AUTHORITY ALIGNMENT
ROLE: Documentation Architecture Agent.
Align: README -> product; GPT -> architectural mandate/shared agent context; AGENTS.md -> agent execution contract; المهام.md -> backlog/scope state; PROJECTS.md -> project map; docs/ -> technical design/evidence.
Correct/remove stale SHA, stale status, obsolete MVP scope, obsolete architecture, false certification, and duplicate authority claims.
Documentation MUST NOT become a second runtime source of truth. Canonical runtime structures remain authoritative.
EXIT: documentation authority chain aligned or BLOCKER.

# PROMPT 15 — DEPLOYMENT / PRODUCTION IDENTITY
ROLE: Release Identity Agent.
Prove: main exact SHA -> certified build artifact -> production deployment -> immutable identity -> production browser verification.
Verify deployment SHA, build artifact identity, worker identity, production URL response, and production browser smoke.
Execution deployment is not production truth.
Inspect Cloudflare, Vercel, and browser runtime relationships. Prove file processing remains browser-local.
Any identity mismatch MUST FAIL CLOSED.
If no production deployment is part of the candidate, record NOT_APPLICABLE with evidence.
EXIT: lineage verified or blocker/NOT_APPLICABLE with evidence.

# PROMPT 16 — SUPABASE / PERSISTENCE BOUNDARY
ROLE: Persistence Boundary Agent.
Inspect every persistence dependency and classify it as MVP-required, optional, stateless, admin-only, or Post-MVP.
Prove local image/file editing does not require Supabase.
If an implicit dependency exists, remove it from the local path or make it explicitly optional.
Do not remove genuinely used persistence features without dependency analysis.
Add a regression test proving MVP editing works without the persistence service.
EXIT: persistence boundary proven or BLOCKER.

# PROMPT 17 — CLEAN-CLONE FINAL RED TEAM
ROLE: Final Red-Team Agent.
TEST-ONLY PHASE. Do not fix code during the test run.
Start from a clean checkout of the candidate SHA. Do not use cached assumptions, prior state, stale artifacts, or previous results.
Run: checkout exact SHA; install; typecheck; lint; core tests; MVP corpus; Agent tests; Browser E2E; security checks; CodeQL; coverage; artifact verification; exact-SHA verification; production/deployment identity verification when applicable.
Attack/test Agent workflow, Manual workflow, fallback, privacy, malformed provider output, prompt injection, oversized input, invalid parameters, worker abort, provider failover, output corruption, and stale-SHA protection.
Record failures exactly as observed.
If any required gate fails: STATUS=FAIL and produce ONE narrowly scoped repair prompt.
EXIT: RED_TEAM_PASS on one candidate lineage or FAIL with exact blocker and repair prompt.

# PROMPT 18 — RELEASE CANDIDATE FREEZE
PREREQUISITE: Prompt 17 PASS.
Freeze execution as Release Candidate.
FORBIDDEN after freeze: feature work, architecture expansion, new capabilities, registry expansion, unrelated refactoring.
ALLOWED only: bug fixes, security fixes, contract-correcting tests, documentation corrections.
Create Release Candidate Evidence Record:
CURRENT_SHA=
TESTED_SHA=
BUILT_SHA=
BROWSER_VERIFIED_SHA=
SECURITY_VERIFIED_SHA=
COVERAGE_VERIFIED_SHA=
DEPLOYMENT_SHA=
SCOPE_ID=
REQUIRED_CHECKS=
All identities MUST belong to the same candidate lineage.
EXIT: complete freeze record or BLOCKER.

# PROMPT 19 — FINAL CERTIFICATION GATE
ROLE: Certification Evidence Agent.
NO CODE MUTATION.
Verify only the final candidate SHA.
Required identities: CURRENT_SHA, TESTED_SHA, BUILT_SHA, BROWSER_VERIFIED_SHA, CERTIFIED_SHA, and DEPLOYED_SHA when applicable.
Verify CODE: typecheck, lint, build PASS.
Verify TESTS: core, MVP corpus, Agent, browser, Red Team PASS.
Verify SECURITY: CodeQL, security audit, secret scanning, workflow integrity PASS.
Verify COVERAGE: coverage PASS and Codecov PASS or documented approved policy.
Verify GOVERNANCE: required review satisfied, main protected, required checks strict, no direct main mutation.
Verify SCOPE: one canonical MVP scope, no hidden executable capability, one registry, one executor authority, one execution gate.
Verify DEPLOYMENT: exact SHA identity, production response, production browser proof when applicable.
If all required evidence passes, create Certification Evidence. Otherwise set CERTIFICATION=NOT_READY and record every blocker.
Never use CERTIFIED when evidence does not fully match.
EXIT: CERTIFICATION_EVIDENCE or NOT_READY.

# PROMPT 20 — OWNER-AUTHORIZED FINAL PROMOTION
PREREQUISITES: Prompt 19 complete, valid Certification Evidence exists, human owner authorization exists.
Before promotion verify current exact candidate SHA, required checks on that exact SHA, PR head/base, no stale evidence, branch protection, and Release Candidate Freeze.
PROMOTE ONLY THROUGH: execution -> main.
NEVER direct-write main.
After merge: resolve new main SHA; run canonical CI on main; re-run exact-SHA verification; verify production deployment identity; run production browser smoke; verify deployed SHA belongs to the certified release lineage.
If any post-merge identity or verification mismatch exists: do not declare success; open a new scoped repair on execution.
EXIT: PROMOTION_VERIFIED or FAIL_CLOSED with blocker.

# 3. REQUIRED STATE RECORD
For every prompt record:
PROMPT_ID=
START_SHA=
END_SHA=
STATUS=PASS|GAP|BLOCKER|NOT_READY
MUTATED=true|false
TESTS=
REQUIRED_CHECKS=
EVIDENCE=
STALE_EVIDENCE_INVALIDATED=
BLOCKERS=
NEXT_PROMPT=
This is evidence/state metadata only. It MUST NOT become a runtime source of truth.

# 4. ANTI-INFLATION RULES
IMPLEMENTED != VERIFIED
VERIFIED_ON_OLD_SHA != VERIFIED_ON_CURRENT_SHA
SINGLE_CI_JOB_PASS != GLOBAL_GREEN
SKIPPED != PASS
CANCELLED != PASS
UI_VISIBLE != EXECUTION_PROVEN
OUTPUT_EXISTS != OUTPUT_VERIFIED
PROVIDER_RESPONSE != EXECUTION_AUTHORITY
DOCUMENTATION_CLAIM != RUNTIME_EVIDENCE
DEPLOYMENT_EXISTS != PRODUCTION_CERTIFIED
HISTORICAL_BASELINE != CURRENT_STATE

# 5. AUTHORITY MODEL
RUNTIME AUTHORITY:
- canonical capability/tool definitions
- canonical capability registry
- execution gate
- canonical executor
- output contract
- verifier
LLM / AGENT:
- reasoning
- proposal
- intent interpretation
- plan proposal
The LLM/Agent does NOT own execution authority.
EXTERNAL WORKERS: implementation/review/evidence support only; no independent certification authority and no governance bypass.
CERTIFICATION: evidence gate only; no runtime authority.

# 6. DEFINITION OF DONE
The plan is NOT complete until:
1. Prompts 01–19 have valid evidence on the final candidate lineage.
2. Final Red Team PASS exists.
3. Release Candidate Freeze exists.
4. Final Certification Gate PASS exists.
5. Owner-authorized promotion occurs through execution -> main.
6. Post-merge canonical CI passes on the new main SHA.
7. Production identity matches certified release lineage when applicable.
8. No stale certification claims remain.
9. No hidden executable MVP capability exists outside canonical scope.
10. No second registry exists.
11. No second executor authority exists.
12. No direct main mutation occurred.

FINAL STATES ARE LIMITED TO:
RELEASE VERIFIED
OR
NOT READY — BLOCKERS ENUMERATED
There is no intermediate state called GREEN or CERTIFIED.

# 7. CODEX START DIRECTIVE
START NOW.
1. Read this plan.
2. Execute PROMPT 01 first.
3. Establish the CURRENT exact SHA.
4. Ignore stale historical evidence for certification purposes.
5. Determine PASS/GAP/BLOCKER.
6. Continue sequentially through PROMPT 20.
7. Mutate only when a real GAP exists.
8. Keep all mutations on execution.
9. Verify every mutation.
10. Invalidate stale evidence after every SHA change.
11. Do not stop for routine confirmation.
12. Do not declare completion early.
13. Do not broaden scope.
14. Do not fabricate evidence.
15. Do not bypass failures.
16. Continue until the plan reaches RELEASE VERIFIED or NOT READY — BLOCKERS ENUMERATED.
The repository state, exact SHA, executable contracts, tests, GitHub checks, and current evidence are the source of truth.
BEGIN WITH PROMPT 01.