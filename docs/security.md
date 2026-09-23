# FLIXO Security Baseline

FLIXO uses a layered security baseline without adding a second application architecture.

## Application and CI gates

- TypeScript type checking
- ESLint
- Production build
- `npm audit --omit=dev --audit-level=high`
- GitHub CodeQL for JavaScript/TypeScript
- Isolated Playwright E2E checks per tool
- GitHub Secret Scanning / Push Protection where enabled in repository settings
- Repository workflow security baseline (`repository-security-baseline.yml`)

## Repository protection contract

`main` is the canonical production branch and `execution` is the only working branch. The repository uses exactly two active branch paths:

```text
execution → main
```

1. No direct pushes to `main`.
2. No force-push or branch deletion on `main`.
3. All active work is performed on `execution`.
4. The only integration PR is `execution → main`.
5. Canonical CI checks are required before merge.
6. Security-sensitive paths require owner review through CODEOWNERS.
7. Auto-merge is allowed only when every required check is green on the exact `execution` PR head SHA.
8. Repair agents must not create or use any third branch.
9. Diagnostic, Vercel, partial, or advisory checks cannot independently certify `GREEN`.

Historical branches may remain as archived Git history, but they are not valid execution paths. Any automation that attempts to create, push, or merge a third branch must fail closed.

The repository-level Ruleset/branch-protection settings are platform controls and must remain enabled in GitHub. The source tree cannot safely self-grant those administrative protections.

## Workflow trust boundaries

The repository baseline rejects `pull_request_target`, rejects `permissions: write-all`, and limits `contents: write` workflows to an explicit allowlist. Workflows should request the smallest possible `GITHUB_TOKEN` permissions.

Write-capable automation is intentionally limited to the repair/merge control plane. Any future write-capable workflow must be reviewed and added explicitly to the allowlist rather than silently inheriting write authority.

## Supply chain

CI contains a Socket gate. It runs as a blocking check when the repository secret `SOCKET_SECURITY_API_KEY` is configured. When the secret is not configured, the step is explicitly skipped so the baseline remains green while the integration is being provisioned.

Dependabot is enabled for npm dependencies. Workflow actions should be pinned to immutable versions or reviewed tags, and runtime/container images used by certification jobs should remain digest-pinned where practical.

## Secrets

Never commit tokens, API keys, private keys, or production credentials. Prefer GitHub/Vercel secret stores. If a secret is suspected to be exposed, revoke/rotate it first, then repair the repository history and configuration.

Secret Scanning and Push Protection should be enabled in GitHub repository settings. These are administrative controls and cannot be enabled safely by a source-file change alone.

## Input and application boundaries

DOMPurify is intentionally not installed globally. Ordinary UI rendering must use React text/nodes and must not use `dangerouslySetInnerHTML`. The only permitted `dangerouslySetInnerHTML` sinks are JSON-LD `<script type="application/ld+json">` blocks whose serialized payload is escaped for `<` before insertion.

Untrusted persisted state, API responses, checkpoints, and file inputs are validated at their runtime boundaries before entering domain state.

## Rules

1. Prefer platform controls and existing CI gates over new dependencies.
2. Add a security package only when a concrete threat or code path requires it.
3. Keep tool isolation intact.
4. Never weaken existing CI checks just to make a run green.
5. Treat browser-reported MIME as advisory; file safety must include extension, MIME, magic bytes, and decoder validation where applicable.
6. Every security repair must record root cause, hardening control, exact-SHA evidence, and regression proof.
7. Branch topology is fixed: `execution` is the sole working branch and `main` is the sole production branch.


## P0 — SYSTEM VULNERABILITY REPORT / RED-TEAM R1–R20 — 2026-09-22

This section is the persistent security record for the current Red-Team vulnerability report. Findings R1–R20 are **P0** and remain open for verification until each item has fresh exact-SHA evidence and the final certification is Canonical GREEN. Code hardening may be implemented while the report remains **VERIFICATION PENDING**.

| ID | Severity | Finding / control objective | Current status |
|---|---|---|---|
| R1 | CRITICAL | Chair-1 reclaim must require authenticated user-direct-command proof; text alone is insufficient. | Hardened in code; verification pending |
| R2 | CRITICAL | Publication authorization must reject wildcard path scope and bind exact normalized paths. | Hardened in code; verification pending |
| R3 | HIGH | Exact-head proof digest must be recomputed and verified, not merely generated. | Hardened in code; verification pending |
| R4 | HIGH | Chair Push Guard / Head Authority lifecycle must have one consistent Chair-1 activity invariant. | Hardened in code; verification pending |
| R5 | CRITICAL | Auto Repair Chair-1 approval must be independent; executor cannot create its own reviewer identity or APPROVED result. | Fail-closed pending independently signed Chair-1 approval |
| R6 | HIGH | Auto Repair publication must not contain an unreachable post-`exit 1` path. | Hardened in code; verification pending |
| R7 | HIGH | Repair handoff must exist before the guarded publication boundary and remain usable on failure. | Hardened in code; verification pending |
| R8 | CRITICAL | Learning/promotion must not occur before Canonical GREEN. | Hardened in code; verification pending |
| R9 | CRITICAL | Cell learning must prove a real canonical CI run/result bound to the exact SHA. | Hardened in code; verification pending |
| R10 | CRITICAL | Shared-memory publisher identity must be authenticated, not caller-declared. | Hardened in code; verification pending |
| R11 | HIGH | Privileged communication actor identity must be tied to authenticated transport identity. | Hardened in code; verification pending |
| R12 | CRITICAL | Manual relay inputs must not provide an impersonation path for Master authority. | Hardened in code; verification pending |
| R13 | HIGH | CELL→Master consultation must verify caller identity in addition to registry membership. | Hardened in code; verification pending |
| R14 | HIGH | Council OIDC trust must bind the job workflow source SHA to an explicit trusted allowlist. | Hardened in code/deployed; operational verification pending |
| R15 | CRITICAL / CONDITIONAL | Mutation-test bypass variables must be unavailable in production/Actions and limited to trusted local harnesses. | Hardened in code; verification pending |
| R16 | HIGH / CONDITIONAL | Non-strict Chair paths must not weaken production authorization guarantees. | Hardened in code; verification pending |
| R17 | HIGH / CONDITIONAL | Controller publication decisions must be bound to validated exact target/parent/candidate evidence. | Hardened in code; verification pending |
| R18 | HIGH | Task creation must require a durable entry in `المهام.md`. | Hardened in code; verification pending |
| R19 | HIGH | ACTION-REPAIR-2 / ACTION-HISTORIAN-3 are verification/learning roles, not source-mutation authorities. | Hardened in code/docs; verification pending |
| R20 | MEDIUM / HIGH | Council Wake must require authenticated origin, not only a well-formed commit message. | Hardened in code; verification pending |

### Mandatory P0 closure invariant

`Authenticated Authority → Exact Current SHA → Chair-1 Live Lease → Independent Validation → Verified Head Proof → Exact Candidate/Parent → Canonical GREEN → Publication / Learning Promotion`

### Evidence rules

No R1–R20 finding may be marked closed solely from local tests, static inspection, queued CI, historical SHA evidence, self-generated approval, or commentary.

R5 is intentionally fail-closed until an independently signed Chair-1 approval is supplied and verified.

The required external controls include the configured signing keys/identity secrets and the trusted Council workflow-SHA allowlist. Their values must never be committed to source.

Any regression, provenance anomaly, stale proof, authority bypass, or security-gate failure reopens the affected finding and the P0 security work package.



## Security Red-Team Triad — SECURITY-REDTEAM-TRIAD-v1
## Deep Red-Team Remediation — 2026-09-22

The deep review identified and remediated the Red-Team trust-perimeter gap, incomplete application scan scope, detached-repair branch creation, excessive Auto-Repair permissions, duplicate wake orchestration, premature learning promotion, missing external-block escalation, stale incident delivery, incomplete OIDC job-workflow provenance, and Service Worker sensitive-response caching. These controls remain verification-pending until fresh exact-SHA canonical CI proves the remediation. The Red-Team remains isolated, read-only, manual-dispatch-only, and artifact-only.


The repository contains three independent, read-only security red-team bots that run as **manual, isolated evidence jobs** against an explicitly supplied exact SHA. Each bot executes on its own ephemeral GitHub-hosted runner with repository access limited to \`contents: read\`.

\`SECURITY-REDTEAM-1\` covers control-plane, GitHub Actions, OIDC, permissions, workflow supply-chain and exact-SHA/branch boundaries. \`SECURITY-REDTEAM-2\` covers application-code execution and injection surfaces, DOM sinks, browser storage, dynamic imports, install hooks and credential exposure. \`SECURITY-REDTEAM-3\` covers runtime/data boundaries such as network destination taint, CORS, credentialed requests, redirects, cookies, postMessage, uploads, SVG and SSR/client secret separation.

The triad has no source-mutation, ledger-mutation, certification, GREEN, or peer-wake authority. It does not run from repository pushes and does not dispatch or wake another bot. There is no shared workspace between bots.

Every result is published as an isolated workflow artifact bound to the supplied exact SHA. HIGH/CRITICAL findings may receive read-only A/B Repair Intelligence advisory evidence inside the same isolated runner. Findings are not automatically written to \`الثغرات الامنيه.md\`; promotion into the central security ledger requires a separate canonical workflow or human-controlled action.

The red-team environment is isolated at the workflow/runner/credential boundary; it is not an air-gapped or network-denied sandbox.