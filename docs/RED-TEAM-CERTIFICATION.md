# FLIXO Repository Red-Team Certification Record

## Certification candidate

- Repository: `m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS`
- Base production SHA: `faf261be4476eccf293956d792bbb15e2e019061`
- Certification candidate before this evidence record: `9d38d896d52514a916c3c5d7ed3244ae8db3a601`
- Integration lane: `execution -> main`
- PR: #923
- Certification scope: repository-level adversarial review of agent/tool execution, HITL approval, prompt/context poisoning, durable task identity, provider availability/cost amplification, canonical execution boundaries, file/media safety, API/admin boundaries, and exact-SHA CI evidence.

## Method

The review targets direct and indirect prompt injection, excessive agency, tool misuse, approval manipulation, context/memory poisoning, replay/amplification, resource exhaustion, forged requests, privilege-boundary failures, output-verification failures, privacy/exfiltration paths, and release/evidence integrity.

The security model requires deterministic validation at the execution boundary, explicit confirmation for agent-originated local mutations, canonical capability/executor/output-contract binding, bounded execution, fail-closed verification, and exact-SHA evidence.

## Confirmed findings remediated

### RT4-001 — Action amplification / bounded-plan bypass
Severity: High

The agent response contract previously allowed up to 100 requested tool calls while the canonical execution plan was bounded to 4. This created an excessive-agency and repeated-mutation/availability surface.

Remediation:
- Maximum of 4 requested agent tool calls.
- Runtime fail-closed enforcement for mock and live LLM streams.
- Duplicate `callId` rejection.
- Regression coverage.

### RT4-002 — HITL action-preview forgery surface
Severity: High

The confirmation UI previously relied on model-authored explanatory text and did not independently display the exact normalized action being approved.

Remediation:
- Pending execution now carries a trusted structured preview derived from validated tool calls.
- Tool name and normalized parameters are rendered separately from model text.
- UI contract validates the preview structure.
- Regression coverage verifies the trusted preview.

### RT4-003 — Cross-user learning/context poisoning
Severity: High

Model-derived learning was persisted as PROPOSED, while the context read path previously admitted every non-BLOCKED record. An attacker could therefore seed content that could later reach another user's model context.

Remediation:
- Agent context now admits only `status=VERIFIED` and `canonical_green=true` learning.
- Regression test verifies the persistence query boundary.

### RT4-004 — Public agent provider-spend amplification
Severity: Medium

The public agent had a bounded provider-call budget per request but no request-rate boundary.

Remediation:
- Per-client in-process request rate limiter.
- HTTP 429 on exhaustion.
- Retry-After response header.
- Existing per-request provider-call and timeout bounds retained.

### RT4-005 — Caller-controlled durable task identity
Severity: High

The public agent accepted caller-supplied `taskId` and used it as the durable persistence key. Knowledge of another task identifier could therefore permit record overwrite through the public gateway.

Remediation:
- Public durable task IDs are now server-generated.
- Caller-supplied task IDs are no longer authoritative.

## Re-tested security boundaries

- Agent-generated local mutations require explicit confirmation.
- Locked media layers are excluded from automatic target selection.
- Local media sources are restricted to browser-local `blob:` or `data:` URLs.
- Canonical execution validates executable capability state.
- Canonical executor ID, pixel limit, file-size limit, and output-contract ID must exactly match the canonical capability registry.
- Input size and decoded pixel limits are enforced before execution.
- Execution has bounded timeouts.
- Canonical output verifiers and output contracts run before successful completion.
- Unknown/non-executable capabilities fail closed.
- Tool parameters are validated against canonical schemas with unknown parameters rejected.
- Runtime identity mismatches are rejected.
- Request bodies, chat history, project state, and file metadata have explicit size/schema boundaries.
- Admin sessions use signed tokens, durable session state, capability checks, CSRF origin controls for mutations, and login rate limiting.
- Event gateway requests require a dedicated shared secret and enforce payload limits/idempotency.
- Production worker boundaries prevent the static worker from exposing the agent API directly.

## Exact-SHA CI evidence

The containing commit is the certification record itself. Certification is valid only for the exact commit whose required checks are all green.

Required workflows that must be green on the containing SHA:
- FLIXO CI
- Agent Editor Step 5-6 Verification
- FLIXO Agent Editor - STEP 4
- FLIXO Agent Editor Coverage
- FLIXO CodeQL
- FLIXO Secret Scan

The record intentionally does not claim a green state for a different SHA.

## Release constraints

This Red-Team record does not authorize merge to `main`.

Independent release constraints remain:
1. Main-branch governance configuration requires owner review of the active ruleset state.
2. Production model admission remains governed by `docs/MODEL_LICENSE_MANIFEST.json`.
3. Final promotion requires exact-SHA post-merge production identity verification.

## Certification rule

**RED-TEAM CERTIFIED** means:
1. No unresolved High/Critical Red-Team finding remains in the tested scope.
2. Every confirmed finding above has a code remediation and regression evidence.
3. All required exact-SHA CI/security/browser checks are green on the same containing SHA.
4. `main` is unchanged until the separately governed promotion step.

This record is evidence, not a merge authorization.
