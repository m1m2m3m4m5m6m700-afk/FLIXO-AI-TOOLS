# FLIXO-AI-TOOLS Engineering Protocols

## 1. Dynamic Verification & Problem Skipping

Before changing any file, test, workflow, schema, or RCA, the executor MUST inspect the current state on the current authoritative HEAD.

If the reported problem is already resolved, no longer exists, or its required invariant already holds, the executor MUST NOT modify it.

Required record:

```text
[SKIPPED - ALREADY RESOLVED]

Problem: <identifier>
Evidence: <current source/test evidence>
Current SHA: <exact verified SHA>
Action: NO PATCH
Reason: Required invariant already holds.
```

Historical reports, old CI runs, old artifacts, and old SHAs are diagnostic context only. They cannot justify reopening a resolved issue on a newer SHA.

## 2. Root-Cause-First Repair Loop

Every active failure follows:

```text
DETECT
→ VERIFY CURRENT STATE
→ CLASSIFY ROOT CAUSE / CASCADE / FLAKY / INFRA
→ ASSIGN RCA ID
→ PATCH ROOT CAUSE
→ TARGETED TEST
→ AFFECTED CONTRACT TESTS
→ FULL AFFECTED GRAPH
→ MATRIX VERIFICATION
→ EVIDENCE RECONCILIATION
→ REGRESSION GUARD
→ CLOSE RCA
```

A cascade failure MUST NOT receive a separate root-cause patch when it is provably caused by an already identified root cause.

## 3. Zero False Green

A PASS is valid only when all of the following match:

```text
commit SHA
workflow/run/job/attempt provenance
environment
contract scope
inputs
assertions
artifacts
```

The executor MUST NOT treat any of the following as PASS:

```text
in_progress
cancelled
skipped
partial
stale
masked
allowlisted
weakened
historical
```

## 4. Exact-SHA Certification

All release evidence MUST be generated from the same authoritative SHA being certified.

Each evidence record should identify, where applicable:

```text
commit_sha
workflow_run_id
job_id
attempt
contract_version
timestamp
input_hash
lockfile_identity
runtime_identity
configuration_identity
artifact_identity
status
```

Evidence from another SHA MUST NOT close a current RCA.

## 5. Test Integrity

Tests are executable contracts, not obstacles to a green build.

Never:

```text
remove a failing test
skip a failing case
weaken an assertion
raise a threshold to hide a failure
mask an exception
turn an error into a warning solely to pass
```

A fast-fail or `--max-failures=1` run is diagnostic evidence only unless the full required certification scope has also completed successfully.

## 6. Contract Closure

A root cause may be marked `RESOLVED` only after:

```text
source invariant restored
+
targeted verification PASS
+
affected contract PASS
+
required matrix PASS
+
exact-SHA evidence valid
```

`Release-Safe = YES` requires the full release conjunction, not a single green workflow.

## 7. External Blockers

Infrastructure, provider quota, deployment-rate-limit, or other external failures MUST be classified separately from application defects.

An external blocker MUST NOT be hidden through source or test changes.

Use:

```text
BLOCKED_EXTERNAL
```

with concrete evidence and affected gate.

## 8. Regression Prevention

Every closed root cause should, where technically appropriate, leave behind a regression guard at the strongest practical layer:

```text
static guard
or
unit/contract test
or
runtime/browser assertion
or
CI provenance guard
```

The guard MUST detect recurrence rather than merely reproduce a one-time fix.

## 9. Release Gate Conjunction

Release certification requires:

```text
ALL REQUIRED ROOT CAUSES = RESOLVED
AND
ALL REQUIRED CONTRACTS = PASS
AND
ALL REQUIRED TESTS = PASS
AND
MATRIX FIRST = TERMINAL SUCCESS
AND
CANONICAL CI = CERTIFIED
AND
EXACT-SHA = VERIFIED
AND
NO STALE EVIDENCE
AND
NO HIDDEN BYPASS
AND
NO OPEN RELEASE BLOCKER
```

Failure of any required condition means:

```text
RELEASE-SAFE = NO
```
