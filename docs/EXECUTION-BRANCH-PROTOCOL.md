# FLIXO-AI-TOOLS — EXECUTION BRANCH PROTOCOL

**Protocol:** EXECUTION-BRANCH v1.0
**Canonical work branch:** `execution`
**Canonical stable branch:** `main`
**Default batch size:** 20 successful changes

## 1. Purpose

This protocol establishes one shared integration path for routine repository execution. It is designed for a single active maintainer/agent and explicitly prevents branch proliferation, duplicate CI cycles, and parallel mutable work paths.

## 2. Branch roles

`main` is the stable source of truth, production/release baseline, and final certification target.

`execution` is the sole routine integration and implementation branch. All normal implementation, repair, cleanup, refactoring, documentation, tool expansion, and test-contract work is performed on `execution`.

Feature, repair, diagnostic, workaround, agent, temporary, and per-task branches are prohibited for routine work.

Exception: a branch may exist only when required by an external provider, GitHub operation, historical recovery, or an explicitly approved migration/incident boundary. Such a branch is not a second execution path and must return its validated result to `execution`.

## 3. Single-path execution

The normal route is:

```text
main
  ↓
execution
  ↓
change
  ↓
targeted regression
  ↓
next change
  ↓
...
  ↓
20 successful changes OR end-of-day boundary
  ↓
canonical CI / certification
  ↓
Exact-SHA proof
  ↓
execution → main merge
  ↓
main Exact-SHA confirmation
  ↓
execution synchronized to new main
```

A change is counted only after its targeted regression passes and its intended repository state is present on `execution`.

## 4. Batch rule

The default merge boundary is **20 successful changes**.

A merge must also occur at an earlier boundary when any of the following is true:

- end of the working day;
- a security, authorization, persistence, deployment, or production-sensitive boundary is reached;
- a large architectural/contract boundary is completed;
- continuing would materially increase rollback scope;
- required evidence must be frozen on `main`.

A batch may contain fewer than 20 changes. Twenty is a maximum integration batch, not a requirement to accumulate unnecessary work.

## 5. Testing rule

Do not run full canonical CI for every routine change.

During execution, use the smallest targeted regression that can prove the affected behavior. Existing fast/local/static checks may be reused.

Canonical CI and certification run at the batch-to-main boundary. Evidence from `execution` is not final release evidence until the batch is merged and the resulting exact `main` SHA is verified.

A high-risk change may trigger earlier canonical CI; the batch rule never overrides a safety or evidence requirement.

## 6. No path saturation

The repository MUST NOT accumulate parallel routine branches or long-lived task branches.

The following are prohibited as normal workflow patterns:

```text
one task → one branch
one tool → one branch
one fix → one PR
one day → many feature branches
branch chains / stacked routine PRs
```

The intended shape is:

```text
ONE execution branch
ONE active mutable path
ONE batch integration boundary
ONE main certification target
```

## 7. Conflict and failure handling

If a change fails targeted regression, repair it on `execution` and continue from the resulting exact SHA.

If the batch fails canonical CI, do not split into speculative branches. Perform RCA on `execution`, repair the causal defect, rerun the affected regression, then rerun the required canonical verification for the batch.

If `main` moves for any reason, immediately re-resolve the exact `main` SHA and synchronize `execution` before adding more work.

## 8. Merge contract

A batch may merge only when:

```text
execution batch identified
∧ targeted regressions pass
∧ required canonical CI PASS
∧ certification PASS where required
∧ Exact-SHA evidence matches execution HEAD
∧ no unresolved RCA blocks the batch
```

After merge:

```text
main HEAD = merge result SHA
∧ main is freshly verified
∧ execution base is reset/synchronized to main
```

No branch-local evidence may be used to claim `main` is GREEN.

## 9. Governance integration

This protocol is subordinate to the repository's Zero-False-Green, Exact-SHA, Root-Cause-First, contract, security, and release-certification rules.

The task gate remains authoritative for what may be executed. `CANDIDATE` and `LOCKED` work remains non-executable until promoted by `المهام.md`.

The protocol does not authorize bypassing required tests, coverage, security checks, approvals, evidence, or production gates.

## 10. Session route

Every session uses:

```text
READ PROJECTS.md
→ READ المهام.md
→ READ AGENTS.md
→ RESOLVE main SHA
→ RESOLVE execution SHA
→ CLAIM ACTIVE TASK
→ CHANGE ON execution ONLY
→ TARGETED REGRESSION
→ RECORD BATCH COUNT
→ BATCH CI AT 20 / EOD / SAFETY BOUNDARY
→ EXACT-SHA PROOF
→ MERGE execution → main
→ VERIFY main SHA
→ SYNC execution
→ HANDOFF / LOGOUT
```
