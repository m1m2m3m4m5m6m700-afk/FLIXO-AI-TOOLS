# FLIXO-AI-TOOLS — EXECUTION PROTOCOL

**Protocol:** MAIN-FIRST v2.0
**Canonical stable branch:** `main`
**Synchronization branch:** `execution`
**Default batch size:** 20 successful changes

## 1. Purpose

This protocol minimizes routine integration overhead for a single active maintainer/agent. Routine low-risk work may be executed directly on `main` when it has a bounded scope and can be proven immediately. `execution` remains available as the synchronization/recovery branch and must not become a mandatory PR hop for every small change.

## 2. Branch roles

`main` is the stable source of truth, production/release baseline, and final certification target.

`execution` is the synchronization and exceptional integration branch. It is used when a change is too large, risky, conflict-prone, multi-step, or otherwise benefits from isolation before reaching `main`.

Routine feature, repair, diagnostic, workaround, agent, temporary, and per-task branches remain prohibited unless an exceptional recovery or external-provider requirement explicitly requires one.

## 3. Main-first execution

The normal route for a bounded routine change is:

```text
main
  ↓
inspect exact SHA
  ↓
change
  ↓
targeted regression
  ↓
Exact-SHA verification
  ↓
continue next bounded change
```

Direct `main` execution is authorized only when all of the following are true:

```text
single active owner
∧ bounded change scope
∧ no unresolved RCA dependency
∧ targeted regression is available
∧ change does not require long-lived isolation
∧ no production mutation is enabled without its own contract
```

## 4. When isolation is mandatory

Use `execution` before `main` when any of the following applies:

- security/authentication/authorization changes with broad impact;
- persistence or destructive/production-sensitive mutation;
- major architectural or contract changes;
- rollback scope is materially large;
- multiple interdependent changes must be developed together;
- canonical evidence must be frozen only after a controlled integration boundary;
- direct `main` work would make RCA attribution ambiguous.

The isolation route is:

```text
main baseline
  ↓
execution
  ↓
change
  ↓
targeted regression
  ↓
canonical CI / certification when required
  ↓
Exact-SHA proof
  ↓
execution → main
  ↓
verify main
  ↓
synchronize execution
```

## 5. Batch rule

The default maximum batch is **20 successful changes**, but batching is optional for small direct-to-main changes. Do not accumulate changes merely to reach 20.

An earlier certification/integration boundary is mandatory for:

- end of the working day;
- security, authorization, persistence, deployment, or production-sensitive boundaries;
- major architectural/contract boundaries;
- materially increasing rollback scope;
- any requirement to freeze final evidence on `main`.

## 6. Testing rule

Use the smallest targeted regression capable of proving the affected behavior.

Full canonical CI is not required for every low-risk routine change. It is required whenever the governing contract, affected graph, release boundary, or task closure requires it.

No branch-local, historical, partial, stale, or inferred evidence may be used to claim final `main` GREEN.

After every direct `main` change:

```text
resolve exact main SHA
→ inspect targeted checks
→ run required verification
→ record resulting SHA/evidence
```

## 7. Zero-False-Green / safety invariants

Direct `main` execution is a speed optimization, not a permission to weaken controls.

Never:

```text
skip a required assertion
weaken expected behavior to fit a defect
suppress a failure
remove coverage
bypass authorization
bypass approval
invent evidence
enable production mutation without a proven contract
```

`FAIL`, `BLOCKED`, `UNKNOWN`, `MISSING_EVIDENCE`, `STALE`, and `NOT_EXECUTED` remain non-GREEN states.

## 8. Conflict and failure handling

If a direct `main` change fails targeted regression:

```text
stop follow-on changes
→ RCA
→ repair causal source
→ targeted regression
→ fresh exact main SHA
```

Move to `execution` when the repair becomes materially complex, requires multiple coordinated changes, or risks destabilizing `main`.

If `main` moves, immediately re-resolve its exact SHA before continuing. `execution` must be synchronized to the resulting `main` state before being used for further work.

## 9. Governance integration

This protocol remains subordinate to:

`Zero-False-Green → Exact-SHA → Root-Cause-First → contract/security/release requirements → task gate`

`المهام.md` remains authoritative for task status and dependencies. `CANDIDATE` and `LOCKED` work is not executable until promoted.

This protocol does not authorize bypassing required tests, certification, approvals, evidence, or production controls.

## 10. Session route

Every session uses:

```text
READ PROJECTS.md
→ READ المهام.md
→ READ AGENTS.md
→ RESOLVE exact main SHA
→ IDENTIFY ACTIVE TASK
→ READ authoritative contract
→ RCA / scope lock
→ MAIN-FIRST CHANGE when eligible
   OR
   execution isolation when required
→ TARGETED REGRESSION
→ REQUIRED CI / CERTIFICATION
→ EXACT-SHA PROOF
→ UPDATE PROJECT MAPS
→ SYNC execution to main when main moved
→ HANDOFF / LOGOUT
```
