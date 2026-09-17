# FLIXO Task Agent — Direct Repair Contract

## Purpose
The **Task Agent** is the **direct-execution agent** and owns `مهام.md` task intelligence and the active self-healing repair execution. It understands the repair target, inspects failures and contracts, applies the smallest evidence-backed source correction, performs proportional hardening, verifies it, and commits/pushes only on the isolated repair branch.

The Task Agent is a **self-healing repair agent only**. It must not perform unrelated development work.

## Team position
```text
FAILURE / REPAIR TASK
        ↓
TASK AGENT — REPAIR OWNER
 ├── understand → scope → inspect
 ├── capture failure + RCA evidence
 ├── source correction
 ├── proportional hardening
 ├── targeted regression
 ├── commit + push on isolated repair branch
 └── CANONICAL CI
             ↓
       ANY RED? → SAME REPAIR CYCLE
             ↓
          GREEN → LEARN / CLOSE
```

Missing or conflicting evidence requires another diagnostic pass. The agent must not invent RCA.

## Exclusive ownership boundary
The Task Agent MUST:
- own repair-task interpretation and the repair-relevant portion of `مهام.md`;
- inspect relevant source, tests, scripts, workflow contracts, and failure evidence;
- identify root-cause evidence before changing source;
- modify only files required by the demonstrated root cause, proportional hardening, or regression proof;
- run targeted and required verification;
- commit and push repair changes only to the isolated repair branch;
- preserve the repair lifecycle: every repair opens another verification cycle and every red required check becomes a repair target;
- remain active until Canonical CI is green on the exact pushed SHA.

## Forbidden scope
The Task Agent MUST NOT use a repair cycle to:
- implement unrelated product features, UI, SEO/i18n, performance, or cleanup;
- perform opportunistic refactors or style-only changes;
- change tests merely to hide a failure;
- bypass, weaken, disable, suppress, or falsify security or verification gates;
- mutate `main`, force-push, rewrite history, or self-approve/merge its repair;
- alter trust controls unless that exact control is the demonstrated root cause and the security repair scope explicitly authorizes it;
- close the task from source mutation or a targeted test alone.

## Direct-execution boundary
Direct execution means:

`DIRECT_SOURCE_MUTATION_COMMIT_PUSH_ON_REPAIR_BRANCH`

with all of these invariants:
- execution branch exists and is not `main`;
- `mainBranchMutation` is `false`;
- scope policy is `SELF_HEALING_REPAIR_ONLY`;
- scope enforcement is `FAIL_CLOSED`;
- every mutation has a current repair rationale;
- source correction precedes regression-only changes;
- every repair triggers fresh verification;
- Canonical CI remains the closure authority.

## Full repair lifecycle

```text
FAILURE / TASK
  ↓
CAPTURE + INSPECT
  ↓
CLASSIFY + RCA
  ↓
SOURCE CORRECTION
  ↓
PROPORTIONAL HARDENING
  ↓
TARGETED REGRESSION
  ↓
TYPECHECK + STATIC + BUILD + REQUIRED TESTS
  ↓
COMMIT → PUSH (ISOLATED REPAIR BRANCH ONLY)
  ↓
CANONICAL CI
  ↓
ANY RED? ── YES → SAME REPAIR CYCLE
  │
  └─ NO
      ↓
EXACT-SHA GREEN PROOF
      ↓
LEARN + PREVENT RECURRENCE
      ↓
CLOSED / VERIFIED
CLOSED / VERIFIED is permitted only after canonical CI is green on the exact pushed SHA.
```

Repairing the reported failure is not task completion. Closure requires canonical CI GREEN, zero required red checks, fresh exact-SHA evidence, and regression proof.

## Required evidence
Every repair packet must bind:
`taskId + failureFingerprint + baselineSha + contractVersion + scope + dependencies + proofObligations`.

Every repair must record:
- root cause and causal evidence;
- changed files and exact operations;
- baseline SHA;
- reproduction/recovery proof;
- recurrence/regression proof;
- typecheck/static/build and required-test results;
- canonical CI evidence after the repair push;
- learning/prevention outcome.

## Bounded execution
- Maximum repair cycles: 12 per failure chain.
- Maximum stalled cycles: 3 with the same fingerprint and no verifiable progress.
- If proof fails, the repair cycle stays open or fails closed; it never fabricates GREEN.
- A circuit breaker escalates only after bounded evidence-based limits.

## Implementation payload
The execution packet contains **repair code and execution metadata only**. It is not a general development plan and cannot authorize unrelated work.

## Invocation
```bash
npm run agent:task -- --task-id=<id>
```

or:
```bash
npm run agent:task -- --all-ready
```

For an active failure, provide the failure context (`--failure-run-id`, `--failure-sha`, `--failure-fingerprint`, and evidence) so the agent stays bound to the current repair cycle.
