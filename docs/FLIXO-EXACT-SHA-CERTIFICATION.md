# FLIXO — Exact-SHA Certification Record

Status: CANDIDATE VERIFIED / HUMAN CERTIFICATION REQUIRED

## Candidate identity
- Repository: `m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS`
- Branch: `execution`
- Candidate SHA: `e72f4243fdcfb6f50795cf5e956cd907079a2665`
- Main baseline SHA: `8a4bb5b8772791dfb718850519c51eb2cfe801af`
- PR: #889
- PR base: `main`
- PR head at evidence capture: `e72f4243fdcfb6f50795cf5e956cd907079a2665`

## Exact-SHA verification runs

| Workflow | Run | Result |
|---|---:|---|
| FLIXO CI | 36430043071 | PASS |
| Agent Editor Step 5-6 Verification | 36430043520 | PASS |
| FLIXO Agent Editor - STEP 4 | 36430043177 | PASS |
| FLIXO Agent Editor Coverage | 36430043151 | PASS |
| FLIXO CodeQL | 36430043265 | PASS |
| FLIXO Secret Scan | 36430043358 | PASS |

### FLIXO CI job evidence
- typecheck/lint/core contracts/build: PASS
- model license/admission gate: PASS (fail-closed; no production model admitted)
- npm test: PASS
- production audit: PASS
- production build: PASS
- exact build identity: PASS
- Chromium browser smoke: PASS
- browser runtime evidence upload: PASS
- trust-gate: PASS
- Exact-SHA promotion proof: PASS

### Agent Editor evidence
- type-check: PASS
- lint: PASS
- runtime tests: PASS
- isolated/full test suite: PASS
- production build: PASS
- Chromium/browser E2E: PASS
- Exact-SHA evidence: PASS
- coverage generation + SHA-bound artifact: PASS

## Gate status

| Gate | Current | Evidence |
|---|---|---|
| G0 Baseline | PASS | candidate/main/PR identity above |
| G1 Public Agent Boundary | PASS | gateway boundary + specialist privacy regression tests in current `npm test` |
| G2 Model Admission | PASS / FAIL-CLOSED | manifest structure and admission policy pass; entries=0, so no production model is admitted |
| G3 Failover / Resilience | PASS | model/router/runtime regression suite in current `npm test` |
| G4 Canonical Tool Execution | PASS | canonical registry/runtime/adapter contracts and MVP proof tests |
| G5 Browser / Privacy | PASS | Chromium smoke + browser runtime evidence + privacy contract coverage |
| G6 Functional MVP | PASS | core contract + MVP proof + Agent Editor suites |
| G7 Red-Team | PASS | red-team regression coverage in core suite |
| G8 Exact-SHA CI | PASS | FLIXO CI + Exact-SHA promotion proof |
| G9 Browser Acceptance | PASS | Chromium browser smoke on candidate SHA |
| G10 Certification | HUMAN ACTION REQUIRED | agent records evidence only; repository policy requires human certification/promotion authority |

## Scope
MVP executable scope is exactly 10 capabilities:
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

## Architecture invariants verified by the candidate
- Public agent identity is `FLIXO_AGENT`.
- Internal specialists are not user-selectable.
- Model output is planning data, not execution authority.
- Canonical capability registry is the execution source of truth.
- Agent and Manual paths converge on canonical execution contracts.
- File manipulation remains browser-local for MVP execution.
- Fallback is bounded and fail-closed.
- Executor success is not accepted as task success without verification.
- Stale/skipped/cancelled evidence is not treated as PASS.
- No direct `main` write or autonomous promotion is performed.

## External evidence limitations
1. GitHub connector cannot read the repository Branch Protection endpoint; protection is therefore not independently certified by this record.
2. Vercel connected app currently exposes zero projects for team `flixoai`; current production deployment identity cannot be verified from the connected account.
3. The model license manifest intentionally contains zero admitted production models. Deterministic/local fallback remains fail-closed and operational, but live hosted-model production admission is not established.
4. No merge/promotion to `main` is performed here.

## Decision
The candidate SHA has **fresh PASS evidence for all technical workflows executed above**.

This is **not** a production certification because G10 requires the repository's Human Authority, and production identity / branch-protection evidence remains externally unverified.

A subsequent documentation-only mutation creates a new SHA and invalidates this exact candidate evidence; therefore this record is authoritative only when its candidate SHA equals the currently tested SHA.
