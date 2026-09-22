## 0. SUPREME FIRST OBLIGATION — P00

Before any branch operation, every Master/Agent/Bot MUST admit:
RPR-UNIFIED-EXECUTION-001 v4.0.0 → docs/agents/PROMPT-UNIFIED-EXECUTION.md.

Branch rules are subordinate to P00. The only active mutation path remains execution → main; no branch operation can be used to bypass the zero-error, Exact-SHA, liveness or circular-exit controls.

# FLIXO-AI-TOOLS — TWO-BRANCH EXECUTION PROTOCOL

**Protocol:** TWO-BRANCH / FAIL-CLOSED v1.0  
**Base / working branch:** `execution`  
**Primary / production branch:** `main`

## 1. Canonical branch model

The repository has exactly **two active branch paths**:

```text
execution → main
```

- `execution` is the only branch where routine development, repair, testing fixes, agent work, and integration preparation may occur.
- `main` is the only production/source-of-truth branch.
- No feature, fix, chore, repair, bot, agent, test, diagnostic, temporary, experimental, preview, backup, or per-task branch may be created or used as an active work path.
- Historical branches may remain as archived Git history, but they are not valid execution paths.

## 2. Mandatory route

Every change follows exactly this route:

```text
main
  ↓ synchronize execution
execution
  ↓ understand / RCA / change / test
execution
  ↓ exact-SHA + canonical CI
execution → main
  ↓ verify exact main SHA
main
  ↓ synchronize execution
execution
```

There is no third branch, alternate repair lane, or parallel PR lane.

## 3. Repair model

Self-healing repair is performed directly on `execution` under the Task Agent contract.

The repair agent MUST:
- bind the failure to the exact failed SHA and evidence;
- require root-cause evidence;
- mutate only `execution`;
- keep `main` immutable during repair;
- run targeted regression and required checks;
- push only to `execution`;
- use the single canonical `execution → main` integration path;
- keep the repair cycle open until Canonical CI is GREEN on the exact `execution` SHA.

A failed repair never creates another branch. A new RED remains inside the same execution path and repair cycle.

## 4. Main protection

`main` is never a working branch for agents.

Agents MUST NOT:
- push directly to `main`;
- force-push `main`;
- create a repair/feature branch from `main`;
- merge a non-canonical branch into `main`;
- bypass required checks or security gates.

Promotion to `main` is permitted only from `execution` after exact-SHA evidence and all required Canonical CI gates are GREEN.

## 5. Execution branch invariants

Before mutation:

```text
current branch == execution
AND
execution is synchronized with the current main baseline
AND
one active workstream owns execution
AND
no competing execution PR exists
```

If `execution` contains unresolved work or has diverged from the current `main` baseline in a way that cannot be safely reconciled, the agent MUST fail closed rather than create another branch.

## 6. Single integration path

There is exactly one integration PR at a time:

```text
execution → main
```

The merge gate must reject every other head branch. The repair system must reuse this same PR/path rather than opening a new PR for every failure.

## 7. Zero-complexity rule

The following are prohibited:

```text
feature/*
fix/*
chore/*
agent/*
bot/*
auto-fix/*
flixo-auto-repair/*
test/*
preview/*
experiment/*
per-task branches
per-error branches
per-run branches
```

No workflow may derive a branch name from a run ID, PR number, timestamp, task ID, error fingerprint, or agent ID.

## 8. Failure handling

A RED result follows:

```text
RED
 ↓
capture exact evidence
 ↓
RCA
 ↓
repair on execution
 ↓
regression
 ↓
required CI
 ↓
new RED? → same execution cycle
 ↓
GREEN
 ↓
exact-SHA proof
 ↓
execution → main
```

Tests, timeouts, skips, allowlists, retries, or gate changes must never be used to manufacture GREEN.

## 9. Synchronization

After `main` changes, `execution` must be synchronized before new work begins. The synchronization must preserve the current authoritative `main` SHA and must not create a new branch.

## 10. Enforcement

Any automation that attempts to create, push, or merge a branch other than `execution` or `main` MUST fail closed.

Any workflow, script, task packet, or agent contract that references a third active branch is non-compliant and must be corrected before the change can be considered verified.

`main` = production truth.  
`execution` = single working truth.  
**No third path.**
