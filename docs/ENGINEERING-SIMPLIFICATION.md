# FLIXO Engineering Simplification Contract

## Purpose

Reduce accidental complexity without reducing security, coverage, verification strength, or release evidence.

This document is a **derived engineering contract**. It does not replace `PROJECTS.md`, `المهام.md`, `AGENTS.md`, or the canonical CI contracts.

## Single source of truth

```
PROJECTS.md
  ↓
المهام.md
  ↓
approved contracts
  ↓
source / tests
  ↓
Canonical CI
  ↓
Exact-SHA evidence
```

- `المهام.md` is the only executable task ledger.
- `مهام.md` is historical roadmap material only and must not be treated as an executable queue.
- Agent instructions are operational constraints, not a second task ledger.
- Error memory is evidence/learning, never authority.

## Repository boundaries

```
src/          production/runtime code
scripts/      deterministic engineering commands
scripts/ci/   CI orchestration, diagnostics, verification
diagnostics/  durable evidence and session state
docs/         human/machine-readable contracts
tests/        test specifications and browser/unit coverage
.github/      workflow entrypoints
```

Dependency direction is one-way wherever practical:

```
production → contracts
tests      → production/contracts
CI         → tests/contracts/production
diagnostics → CI evidence/contracts
docs       → everything as documentation only
```

Diagnostics must not become a second implementation of production behavior.

## Command facade

The public command surface is intentionally small:

- `npm run dev`
- `npm run check`
- `npm run test`
- `npm run ci`
- `npm run ci:target`
- `npm run ci:repair`
- `npm run ci:certify`
- `npm run release`
- `npm run engineering:check`

The existing specialized scripts remain available internally. New automation should call the facade or an existing canonical command instead of creating another wrapper.

## Verification ladder

```
L1  typecheck + lint/static
L2  unit + contract
L3  production build
L4  targeted browser/E2E
L5  canonical browser matrix
L6  certification / exact-SHA release proof
```

A lower level never replaces a higher required level.

## CI ownership

There is one certification authority. Supporting workflows may diagnose, validate, report, or prepare evidence, but they must not independently declare release GREEN.

The current automated certification authority is `.github/workflows/ci.yml` → job `certify` → `scripts/ci/certification-engine.mjs`. `scripts/validate-ci-contract.mjs` enforces that no second workflow can become a certification authority.

When multiple workflows perform the same deterministic work, consolidate the implementation behind a reusable workflow or shared deterministic command rather than copying steps. GitHub documents reusable workflows specifically as a mechanism to avoid duplicated workflow logic.

## Current workflow ownership map — 2026-09-19

| Workflow | Ownership class | Authority boundary |
|---|---|---|
| `ci.yml` | CORE / CERTIFICATION | Sole automated application + browser + certification owner |
| `wp0-trust-baseline.yml` | TRUST | Exact-SHA trust/provenance/security baseline; not release certification |
| `repository-security-baseline.yml` | SECURITY | Repository security baseline evidence |
| `claude-security-review.yml` | SECURITY / REVIEW | Security review evidence; no release certification |
| `bundle-boundary-contract.yml` | CONTRACT | Browser/server bundle boundary contract |
| `test-matrix-contract.yml` | CONTRACT | Test matrix contract/invariant validation |
| `phase3-chain-compatibility.yml` | CONTRACT / COMPATIBILITY | Compatibility contract; manual/targeted scope |
| `dependency-health.yml` | MAINTENANCE | Dependency inventory/health |
| `dependency-usage-classification-v2.yml` | MAINTENANCE | Dependency usage classification |
| `test-impact.yml` | IMPACT PLANNING | Determines impacted test scope; not certification |
| `test-impact-execution.yml` | IMPACT EXECUTION | Executes selected impacted tests; not certification |
| `auto-repair.yml` | REPAIR | Repair diagnosis/execution; must return evidence to canonical CI |
| `agent-recovery-gate.yml` | AGENT GOVERNANCE | Recovery contract/gate |
| `agent-repair-handoff-gate.yml` | AGENT GOVERNANCE | Repair handoff/continuity |
| `code-read-only-scout.yml` | DISCOVERY | Read-only repository scouting |
| `execution-sync.yml` | SYNC | Canonical execution synchronization only |
| `ultra-investigator.yml` | DIAGNOSTICS | Deep investigation/recovery evidence |
| `root-cause-diagnostics.yml` | DIAGNOSTICS | Root-cause evidence |
| `error-memory-root-cause.yml` | DIAGNOSTICS / MEMORY | Historical root-cause extraction |
| `daily-flixo-green-gate.yml` | MONITORING | Periodic health/green monitoring |
| `ci-slo-report.yml` | OBSERVABILITY | SLO/reporting only |
| `seo-production-certification.yml` | PRODUCT DIAGNOSTIC | Manual SEO diagnostic; not CI release certification |
| `admin-006-persistence-roundtrip.yml` | DOMAIN PROOF | Manual persistence read-back proof; not automated release certification |
| `cd.yml` | DEPLOYMENT | Promotes only an already certified exact SHA |
| `deploy-flixoai.yml` | DEPLOYMENT | Cloudflare deployment boundary; no CI certification |

The map is intentionally descriptive: workflow names containing words such as "certification", "green", or "gate" do not acquire certification authority. Authority is defined by the executable contract above.

## Registry rule

Tool/capability definitions belong to the canonical registry and its loader. Do not add new manual tool lists, duplicate IDs, or tool-specific branches when metadata can express the behavior.

## Refactoring rule

Every simplification must preserve:

- TypeScript/type safety
- lint/static checks
- production build
- browser coverage
- security gates
- exact-SHA provenance
- artifact integrity
- localization/SEO contracts
- zero-false-green behavior
- rollback/recovery behavior

Simplification means **less duplication and fewer authority points**, not fewer guarantees.

## Compatibility-wrapper rule

Legacy validator paths may remain temporarily for callers that still reference them, but they must delegate to the current authority and contain no independent policy. Removing a wrapper requires caller search, test proof, and historical-evidence review.

## Complexity budget

The engineering system tracks these counts as indicators, not release gates by themselves:

- package scripts: target a small public facade
- CI workflows: consolidate duplicate execution owners before deleting any workflow
- CI scripts: merge by responsibility and ownership, not by filename
- task ledgers: exactly one executable ledger
- registry definitions: one canonical definition path
- certification authorities: exactly one

No bulk deletion is permitted merely to reduce counts. A file may be removed only after ownership, callers, tests, and historical evidence are checked.

## Migration order

1. task-ledger normalization
2. command facade
3. contract/ownership map
4. CI ownership map
5. duplicate deterministic logic consolidation
6. dead-code removal with proof
7. import-boundary cleanup
8. anti-complexity regression checks

ACCEL/speed changes are outside this migration unless explicitly reopened.

## Definition of done

A simplification batch is complete only when:

- the new authority is explicit;
- old authority is archived or removed;
- all callers use the new authority;
- targeted regression passes;
- required CI passes;
- exact SHA is recorded;
- no security or coverage gate was weakened.


## Dead-code proof — 2026-09-19

Two redundant entrypoints were removed only after repository-wide caller inspection:

- `scripts/ci/validate-certification-graph.mjs` was a one-line alias of `validate-execution-graph.mjs`. Its only execution consumer was the canonical `ci.yml` certification job; CI now calls the underlying validator directly.
- `verify:contracts` was an alias of `test:static` with no repository caller. It was removed from `package.json`; `verify:fast` remains because `ci:target` and the documented developer fast gate still use it.
- `build:runtime` was retained because `playwright.config.ts` explicitly uses it for the lightweight local preview path.

No test, security, deployment, registry, or production boundary was removed.

## Trigger de-duplication — 2026-09-19

Additional simplification proof: the Canonical CI, WP0 Trust Baseline, and Test Impact Execution workflows no longer declare an `execution` push trigger. Pull-request verification remains the pre-merge authority; `main` push remains the post-merge verification surface. This removes duplicate runs without removing required coverage.
