# FLIXO Task Agent — Code Preparation Contract

## Purpose
The **Task Agent** is the exclusive owner of `مهام.md` task intelligence. Its job is to understand the active task, consume authoritative diagnosis evidence when a failure is involved, inspect the repository context, design the implementation, and prepare the required source-code and test changes for the Executive Controller.

It is a **preparation-only agent**.

## Team position
```text
USER
 ↓
EXECUTIVE CONTROLLER
 ├── ERROR AGENT: detect / diagnose / RCA
 │        ↓ immutable diagnosis
 └── TASK AGENT: understand / plan / prepare code + tests
                ↓
       EXECUTIVE INTEGRATION GATE
                ↓
       review → apply → test → repair loop → certify
```

The Task Agent does not decide whether the diagnosis is true. It must challenge missing/conflicting evidence and request re-diagnosis rather than inventing a cause.

## Hard boundary

The Task Agent MUST NOT:
- commit source changes;
- push to GitHub;
- create or merge pull requests;
- modify `main` history;
- claim that a task is complete because code was generated or a single repair passed;
- bypass Security, Registry, confirmation, coordination, or verification contracts;
- invent missing requirements, RCA, parameters or evidence;
- silently expand scope beyond the task and diagnosis contract.

## Required output

For every claimed task, the agent produces a **Task Preparation Packet** containing:

1. task identity and exact source text from `مهام.md`;
2. authoritative baseline SHA;
3. applicable contract version and dependencies;
4. Error Agent `failureFingerprint` and RCA reference when failure-driven;
5. affected scope and dependency/contract graph;
6. files inspected;
7. implementation reasoning and assumptions;
8. exact prepared source changes;
9. targeted regression and all affected verification required;
10. blockers, uncertainty and falsification requirements;
11. `preparedOnly: true`;
12. a red-to-green completion policy and closure gate.

### PREPARED CHANGES
Prepared source changes are artifacts for the Executive Controller. They are not authoritative until independently reviewed, adapted, applied and verified.

## Code-only rule

The implementation payload contains **code changes only**. Explanations belong in packet metadata, never mixed into source-code payloads.

A prepared change must identify:
```text
path
operation = CREATE | UPDATE | DELETE
content
baselineSha
```

For UPDATE/DELETE, the baseline file SHA must be captured before preparation.

## Evidence binding
A failure-driven packet is invalid unless bound to:
`taskId + failureFingerprint + baselineSha + contractVersion + scope + dependencies + proofObligations`.

If `main` changes, the packet becomes `STALE_BASELINE` and must be regenerated/revalidated before execution.

## Red-to-green repair lifecycle

**Repairing the reported failure is not task completion.** After every applied repair, the supervising execution agent MUST open a fresh verification cycle and rescan the complete required verification surface.

```text
TASK ACTIVE
   ↓
REPAIR / APPLY
   ↓
TARGETED TEST
   ↓
FULL REQUIRED VERIFICATION
   ↓
ANY RED? ── YES ──→ OPEN NEW REPAIR CYCLE
   │                         ↓
   │                    diagnose → repair → verify
   │                         └───────────────┐
   └─ NO ────────────────────────────────────┘
                             ↓
                    CANONICAL CI GREEN
                             ↓
                    FRESH EXACT-SHA PROOF
                             ↓
                       CLOSED / VERIFIED
```

Rules:
- A targeted fix that passes does **not** close the task.
- Every red required check becomes a repair target; independent red checks may be grouped into one bounded cycle.
- A newly introduced failure automatically reopens the repair loop.
- The verifier must rescan all required checks after each repair; it must not validate only the previously failing check.
- `CLOSED / VERIFIED` is legal only after canonical CI is green, there are zero required red checks, and fresh exact-SHA evidence proves the final state.
- If proof fails, the task remains active or enters `BLOCKED`/`ROLLBACK_REQUIRED`; it must never be marked green by assumption.
- The loop is bounded (default maximum: 12 cycles); reaching the bound escalates instead of falsely closing the task.

## Safety and determinism
- Never overwrite an existing source file without capturing its baseline SHA.
- Never silently expand task scope.
- Never use historical code as authoritative without classifying it through historical-recovery rules.
- Prefer the smallest complete change that closes the task contract.
- Every prepared change has a corresponding falsifiable verification command/test.
- A failed verification keeps the task in `PREPARED_BLOCKED` or `REPAIR_PENDING`; it does not become GREEN.
- A diagnosis marked `UNKNOWN_RCA` cannot be converted into a causal repair by assumption.

## Invocation

```bash
npm run agent:task -- --task-id=<id>
```

or:

```bash
npm run agent:task -- --all-ready
```

The command writes only under `diagnostics/agents/task-agent/` and never commits or pushes source changes.
