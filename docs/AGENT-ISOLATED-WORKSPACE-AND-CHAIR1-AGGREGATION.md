# FLIXO — Isolated Agent Workspaces + Chair-1 Final Aggregation

## Canonical execution model

The repository remains two-branch only:

- `execution` — canonical working/integration branch.
- `main` — production/source-of-truth branch.
- No agent receives a task branch.
- No agent creates or publishes a third branch.

## Worker rule

Every worker agent starts by taking exactly one entry snapshot:

`entrySha = execution@task-start`

After that moment the worker has no live dependency on the execution head.

The worker operates inside:

`FLIXO-AGENT-ISOLATED-WORKSPACE-v1`

The workspace is a detached Git worktree created from `entrySha`.

Worker invariants:

1. `entrySha` is immutable for the task.
2. Later movement of `execution` or `main` does not invalidate the worker's local work.
3. The workspace never tracks a branch head.
4. Worker commits are blocked.
5. Worker pushes are blocked.
6. The worker produces a `FLIXO-AGENT-RESULT-v1` containing the patch and evidence.
7. The result is editable by Chair 1 before publication.

## Chair 1 rule

Chair 1 is a permanent **aggregator/integration authority**, not the primary builder for worker tasks.

Chair 1 continuously:

`COLLECT → SNAPSHOT CURRENT → COMPARE → REBASE/MERGE → EDIT → REMOVE/UPGRADE → VERIFY → PUBLISH`

For every pending result, Chair 1 records:

- worker `entrySha`
- `execution` SHA at task start
- `main` SHA at task start
- changed files
- patch digest
- current execution/main state
- reconciliation decision
- any Chair-1 edits
- final publication proof

## Conflict behavior

A worker result is never discarded merely because the repository moved.

Chair 1 may:

- replay the result on the current execution head;
- merge non-overlapping changes;
- edit conflicting content;
- remove an obsolete change;
- upgrade a change to fit the current implementation;
- combine multiple worker results;
- keep a pending result until it can be safely reconciled.

No worker resolves publication conflicts against the live branch.

## Publication authority

Only Chair 1 can:

- modify the integrated candidate;
- create the final execution commit;
- publish to `execution`;
- approve the final execution head transition toward `main`.

Workers are proposal producers only.

## Result handoff

Every completed isolated worker session emits a handoff containing `workspaceResult`.

The worker result is evidence and candidate source material. It is not a certification, merge approval, or branch publication.

## Exact-SHA principle

Exact SHA applies to the worker's **entry snapshot** and to Chair 1's **current integration snapshot**.

A worker does not need to restart merely because `execution` advances while it is working. Chair 1 is responsible for bringing the worker result forward onto the latest state.

## Chair-1 preemption continuity

Taking Chair 1 from an active agent is a **authority transfer**, not a task cancellation.

When any authorized agent explicitly takes Chair 1 while the current holder has an active task:

1. The previous holder's Chair-1 mutation authority is revoked immediately.
2. The task remains `CONTINUING_AFTER_PREEMPTION`.
3. The displaced agent remains active and MUST continue its task rather than stopping.
4. The displaced agent continues in its isolated workspace / handoff-only mode and may continue analysis, implementation preparation, verification, evidence collection and task completion.
5. The displaced agent may **not use the old Chair lease to mutate canonical state, merge, or publish** after preemption.
6. The displaced agent must package all completed work, remaining work, evidence, blockers and next actions and submit them through `CHAIR_1_GUARD`.
7. The new Chair-1 holder becomes the sole mutation/publication authority.
7. The task is not reassigned silently; the continuity record remains bound to the original `taskId` and `targetSha`.
8. Chair 1 receives the full preserved submission and may question the originating agent directly before deciding what to edit, integrate, merge or publish.
9. The next holder revalidates the inherited state before applying any mutation.

Therefore:

`PREEMPT CHAIR != STOP TASK`

Any explicit chair takeover is a transfer of authority only; it is not a reassignment or deletion of the displaced task.

The allowed transition is:

`CHAIR_ACTIVE -> CHAIR_TRANSFERRED -> CONTINUING_AFTER_PREEMPTION -> GUARD_HANDOFF -> CHAIR_1_RECONCILIATION`

A preempted agent that attempts mutation must fail closed. Continuation is for finishing and handing off work, not for bypassing the new Chair-1 authority.
