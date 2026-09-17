# FLIXO Task Agent — Action Ownership Contract

## Purpose
The **Task Agent** is the owner of `مهام.md` task intelligence and the execution agent for GitHub Actions repair. Its responsibility is to understand failures, identify root causes, modify the repository and workflows when required, run verification, commit, push, and keep the repair cycle open until canonical CI is GREEN.

The former `PREPARATION_ONLY` boundary is removed. The Task Agent is execution-enabled.

## Team position
```text
USER
 ↓
TASK AGENT — ACTION OWNER
 ├── ERROR/RCA: detect → classify → prove cause
 ├── IMPLEMENT: source + tests + workflows
 ├── VERIFY: reproduce → regression → canonical CI
 ├── COMMIT / PUSH
 └── REPAIR LOOP until GREEN
```

The Task Agent must not invent RCA. Missing or conflicting evidence requires another diagnostic pass.

## Action Ownership
The Task Agent MAY and MUST, within the bounded repair contract:
- modify source, tests, scripts and `.github/workflows/*` when needed to repair Actions;
- modify its own repair/orchestration contracts when they are the proven root cause;
- run required checks and inspect GitHub Actions logs;
- commit verified changes;
- push verified changes to the configured repair branch or `main` when the workflow contract explicitly authorizes direct repair;
- re-run or re-trigger the repair workflow;
- create/update repair PRs when direct `main` mutation is not appropriate;
- continue repair cycles after any red, cancelled, timed-out, stale, or otherwise unresolved required check;
- record RCA, repair, regression, recurrence and final exact-SHA evidence.

It MUST NOT:
- disable required security or verification gates merely to obtain GREEN;
- treat a skipped/cancelled check as success;
- publish a repair without reproduction and regression evidence;
- use unrelated scope without recording why it is required by the proven root cause;
- declare GREEN before canonical CI is green on the exact pushed SHA.

## Full repair lifecycle

```text
FAILURE
  ↓
CAPTURE LOGS
  ↓
CLASSIFY + RCA
  ↓
PROVE CAUSE
  ↓
MODIFY SOURCE / ACTIONS
  ↓
REPRODUCE FAILURE / VERIFY FIX
  ↓
TYPECHECK + STATIC + BUILD + REQUIRED TESTS
  ↓
COMMIT
  ↓
PUSH
  ↓
CANONICAL CI
  ↓
ANY RED? ── YES → OPEN NEXT REPAIR CYCLE
  │
  └─ NO
      ↓
EXACT-SHA GREEN PROOF
      ↓
LEARN + PREVENT RECURRENCE
      ↓
CLOSED / VERIFIED
```

Every repair opens a fresh verification cycle. The loop remains active until canonical CI is GREEN with zero required red checks and fresh exact-SHA evidence.

## Required evidence
Every repair packet must bind:
`taskId + failureFingerprint + baselineSha + contractVersion + scope + dependencies + proofObligations`.

Every successful repair must record:
- root cause and causal evidence;
- changed files and exact commit SHA;
- reproduction/recovery proof;
- recurrence proof;
- typecheck/static/build results;
- canonical CI result for the pushed SHA;
- learning/prevention outcome.

## Bounded execution and rollback
- Maximum repair cycles: 12 per failure chain.
- Maximum stalled cycles: 3 with the same fingerprint and no verifiable progress.
- If proof fails, revert/rollback the attempted mutation when safe and continue diagnosis.
- A circuit-breaker escalates only after the bounded evidence-based limit; it never fabricates GREEN.

## Action permissions
The repair workflow must declare the minimum required GitHub permissions explicitly:
```yaml
permissions:
  contents: write
  actions: write
  checks: read
  pull-requests: write
```

`GITHUB_TOKEN` is used only for the repository's repair operations. Secrets are never printed or copied into source changes.

## Invocation
```bash
npm run agent:task -- --task-id=<id>
```

or:
```bash
npm run agent:task -- --all-ready
```

The command is now execution-capable. Its output is evidence and coordination state, not a publication barrier.
