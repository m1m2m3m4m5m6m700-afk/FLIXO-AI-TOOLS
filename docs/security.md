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
