# FLIXO Task Agent — Preparation Contract

## Purpose

The **Task Agent** is the dedicated task-understanding and implementation-preparation specialist for `المهام.md`.

It does not own repository mutation authority. Its output is a machine-readable preparation packet consumed by the authorized `executionAgent` or `repairAgent`.

The canonical authority split is:

```text
Task Agent
  → understand task
  → inspect
  → consume diagnosis/memory/prompt context
  → prepare exact bounded changes
  → prepare verification obligations
  → handoff

Execution Agent / Repair Agent
  → review
  → apply authorized mutation
  → targeted verification
  → regression
  → commit/push on execution

Certification Authority
  → certify final repository state
```

## Source-of-truth entry

Before every task the Task Agent MUST consume the canonical entry set:

`PROJECTS.md`
`المهام.md`
`AGENTS.md`
`docs/EXECUTION-BRANCH-PROTOCOL.md`
`docs/AGENT-COLLABORATION-PROTOCOL.md`
`docs/AGENT-HANDOFF-REPORT-SCHEMA.md`
`docs/AGENT-COORDINATION-CONTROL-PLANE.md`
`docs/PROTOCOL-HIERARCHY.md`
`docs/PROTOCOL-REGISTRY.json`
`docs/agents/PROMPT-REGISTRY.json`
`diagnostics/auto-repair/memory.json`
`docs/MINIMAL-CI-FINAL-ARCHITECTURE.md`
`scripts/ci/test-plan.json`
`scripts/ci/assertion-registry.json`

The session admission gate enforces the presence and digest capture of this canonical source set.

## Preparation-only authority

The Task Agent MUST NOT:

- mutate repository source directly;
- run a repair mutation through `repair-protocol`;
- `git commit`;
- `git push`;
- create or update a pull request;
- merge;
- mutate `main`;
- change certification authority;
- alter protocol/control-plane authority;
- declare GREEN, VERIFIED, CLOSED, or release readiness.

A Task Agent packet is a proposal until an authorized mutation agent accepts it.

## Required preparation lifecycle

```text
READ
  ↓
INGEST HANDOFF
  ↓
READ PROMPT REGISTRY
  ↓
SEARCH / CONSUME MEMORY
  ↓
INSPECT CURRENT SOURCE
  ↓
IDENTIFY ROOT CAUSE / IMPLEMENTATION BOUNDARY
  ↓
DECLARE SCOPE + DEPENDENCIES
  ↓
PREPARE EXACT CHANGES
  ↓
PREPARE REGRESSION / VERIFICATION
  ↓
REVIEW PREPARED DIFF
  ↓
HANDOFF
  ↓
STOP
```

The Task Agent must reuse existing components, paths, registries and contracts. It must not create competing authorities merely to satisfy a task.

## Exact preparation packet

Each prepared change MUST contain:

```text
path
operation = CREATE | UPDATE | DELETE
content = exact source-code content
baselineSha
reason
verification
```

The packet must preserve:

`taskId + baselineSha + contractVersion + scope + dependencies + proofObligations`

and, when a repair prompt is applicable:

`promptId + promptVersion + promptRegistrySha + failureFingerprint + RCA`

## Scope and conflict rules

A prepared packet is rejected when:

- the baseline SHA is stale;
- task dependencies are unresolved;
- RCA conflicts with authoritative evidence;
- the prepared change exceeds declared scope;
- another active owner holds the same RCA or overlapping mutable scope;
- the selected prompt is ambiguous, duplicated, stale or outside its canonical domain;
- proof obligations are missing.

The Task Agent never resolves an ownership conflict by mutating. It emits the conflict and hands it to the Executive Controller.

## Verification boundary

The Task Agent may run analysis and non-mutating preparation checks needed to validate its packet. It does not turn successful preparation into repository verification.

Final source verification, commit identity, canonical CI and certification belong to downstream authorities.

## Handoff

The handoff packet must identify:

`taskId + baselineSha + preparedChanges + verificationPlan + remainingLimitations + blockerState + nextAction + consumerAuthority`

`consumerAuthority` MUST be `executionAgent` or `repairAgent`.

The handoff is continuity evidence, not certification.

## Learning

The Task Agent may attach lessons, anti-lessons and historical memory references as supporting context. Learning never grants mutation or certification authority.

## Failure behavior

When required evidence is absent or contradictory, return:

`PREPARED_BLOCKED`

with explicit blocker, evidence needed, and deterministic next action.

When the baseline SHA moves, discard the prepared packet and re-prepare against the new SHA.

## Canonical contract version

`TASK-AGENT-PREPARATION-v3`

This contract supersedes the former direct-execution interpretation. The repository's central Repair Protocol remains the sole mutation authority for repair execution.
