# FLIXO Task Agent — Code Preparation Contract

## Purpose

The **Task Agent** is the exclusive owner of `مهام.md` as a task-intelligence source. Its job is to understand the active task, inspect the repository context, design the implementation, and prepare the required source-code changes for a supervising execution agent.

It is a **preparation-only agent**.

## Hard boundary

```text
مهام.md
  ↓
Task Agent
  ├─ understand task
  ├─ resolve dependencies
  ├─ inspect relevant code/contracts
  ├─ choose implementation scope
  ├─ write prepared code/patch artifacts
  └─ produce verification plan
          ↓
Supervising Agent (ChatGPT)
  ├─ review
  ├─ modify/adapt
  ├─ apply to source tree
  ├─ test
  └─ commit/push when explicitly requested
```

The Task Agent MUST NOT:

- commit source changes;
- push to GitHub;
- create or merge pull requests;
- modify `main` history;
- claim that a task is complete because code was generated;
- bypass Security, Registry, confirmation, or verification contracts;
- invent missing requirements or parameters.

## Required output

For every claimed task, the agent produces a **Task Preparation Packet** containing:

1. task identity and exact source text from `مهام.md`;
2. affected contracts and dependencies;
3. files inspected;
4. root-cause/implementation reasoning;
5. exact prepared source changes;
6. tests/verification required;
7. unresolved questions or blockers;
8. `preparedOnly: true` and the repository SHA used as the preparation baseline.

Prepared source changes are artifacts for the supervising agent. They are not authoritative until reviewed, adapted, applied, and verified by that agent.

## Code-only rule

The implementation payload must contain **code changes only**. Explanations belong in the packet metadata, never mixed into source-code payloads.

A prepared change must identify:

```text
path
operation = CREATE | UPDATE | DELETE
content
baselineSha
```

For UPDATE/DELETE, the baseline file SHA must be captured before preparation.

## Safety and determinism

- Never overwrite an existing source file without capturing its baseline SHA.
- Never silently expand the task scope.
- Never use historical code as authoritative without classifying it through the repository's historical-recovery rules.
- Prefer the smallest complete change that closes the task contract.
- Every prepared change must have a corresponding verification command or test.
- A failed verification keeps the task in `PREPARED_BLOCKED`; it does not become GREEN.

## Invocation

Use:

```bash
npm run agent:task -- --task-id=<id>
```

or:

```bash
npm run agent:task -- --all-ready
```

The command writes only under `diagnostics/agents/task-agent/` and never commits or pushes source changes.
