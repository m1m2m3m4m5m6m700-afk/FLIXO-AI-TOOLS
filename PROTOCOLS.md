# FLIXO-AI-TOOLS Engineering Protocols

## 0. Master Execution Protocol

All repository work MUST be governed by this protocol hierarchy. Sub-protocols are invoked by applicability; they are NOT independent commands that must all be executed on every change.

### Precedence

```text
INTEGRITY / SAFETY
>
EXACT-SHA
>
DYNAMIC VERIFICATION
>
ROOT-CAUSE REPAIR
>
CONTRACT VERIFICATION
>
REGRESSION / INVARIANT LOCK
>
RELEASE CERTIFICATION
>
OPTIMIZATION
```

### Execution state machine

```text
INSPECT
→ CLASSIFY
→ PLAN MINIMUM VALID CHANGE
→ PATCH
→ VERIFY
→ REGRESSION LOCK
→ CERTIFY
```

Rules:

```text
IF reported problem is already resolved:
    SKIP PATCH

IF failure is cascade-only:
    DO NOT duplicate root-cause repair

IF a protocol is not applicable to the change:
    DO NOT invent work merely to satisfy the protocol

IF protocols conflict:
    higher-precedence rule wins

IF required work remains:
    execution is non-terminal
```

The executor MUST use the smallest change that restores the required invariant without weakening another contract. Protocol count MUST NOT become a reason to modify unrelated code.

---

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

---

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

---

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

---

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

---

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

---

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

---

## 7. External Blockers

Infrastructure, provider quota, deployment-rate-limit, or other external failures MUST be classified separately from application defects.

An external blocker MUST NOT be hidden through source or test changes.

Use:

```text
BLOCKED_EXTERNAL
```

with concrete evidence and affected gate.

---

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

---

## 9. Invariant Enforcement & Regression Lock

A technically guardable defect MUST leave an explicit invariant or regression lock after remediation.

The lock MUST state the property that must remain true, for example:

```text
20 public locales remain canonical
Registry ↔ Router parity = 100%
Registry ↔ Sitemap parity = 100%
Registry ↔ SEO parity = 100%
Registry ↔ E2E parity = 100%
production canonical uses real production origin
all required hreflang locales are present
isReady=false is never exposed as production-ready
```

Preferred enforcement order:

```text
compile/static invariant
→ unit/contract assertion
→ runtime/browser assertion
→ CI gate
```

A regression lock MUST fail closed when the invariant is violated. It MUST NOT silently downgrade the failure to warning, skip, retry-until-green, or allowlist the affected case.

---

## 10. Change Impact & Blast-Radius

Before a non-trivial change, identify the affected contract graph. Verification scope MUST cover every directly affected contract and any dependency that can consume the changed invariant.

```text
changed file
→ exported behavior
→ dependent modules
→ contracts
→ workflows
→ release gates
```

Unrelated areas MUST NOT be modified merely to obtain green CI.

---

## 11. Two-Layer Verification

Every remediation MUST use at least two verification layers when the defect is technically testable:

```text
Layer A: direct/targeted verification
Layer B: dependent contract or runtime verification
```

For release-impacting changes, the chain extends to the required matrix and exact-SHA certification.

A targeted PASS alone MUST NOT close a systemic RCA.

---

## 12. Negative Testing

Critical contracts MUST test both the valid state and at least one meaningful invalid state where practical.

Examples:

```text
invalid locale
missing translation
wrong canonical origin
missing hreflang locale
unready tool exposure
bad file signature
corrupted output
```

Negative cases MUST fail for the intended reason and MUST NOT be disabled simply because they expose a regression.

---

## 13. Determinism

Required verification MUST be reproducible under the declared runtime, lockfile, configuration, and input identity.

A nondeterministic result MUST be classified rather than averaged away. Retries may diagnose suspected flakiness but MUST NOT convert an unexplained failure into PASS.

---

## 14. Evidence Freshness

Evidence has an explicit freshness boundary. Only evidence generated from the authoritative SHA and matching required environment/configuration may certify the current state.

Stale checkpoints, prior successful runs, historical artifacts, and copied results MUST remain non-certifying evidence.

---

## 15. Dependency Boundary

A change MUST NOT bypass an existing source-of-truth or contract boundary by introducing a parallel registry, duplicate locale authority, alternate route resolver, hidden fallback, or test-only truth.

When two authoritative representations disagree, repair the shared source of truth or explicitly prove why one is derived.

---

## 16. Production Parity

Verification that can affect production behavior MUST use production-equivalent assumptions for:

```text
origin
routing
base paths
locale negotiation
environment variables
build configuration
artifact generation
```

Localhost, preview, test-only URLs, and mocked providers MUST NOT be treated as production certification evidence.

---

## 17. Failure Budget = Zero for Required Gates

Required release contracts have no tolerated hidden failure budget.

```text
required failure count > 0
→ RELEASE-SAFE = NO
```

Known external blockers may be classified as `BLOCKED_EXTERNAL`, but they MUST remain visible and MUST prevent a release-safe claim until the required gate is legitimately cleared or formally re-scoped by the governing release process.

---

## 18. No Silent Fallback

Fallbacks that can hide a contract violation MUST be explicit and observable.

Forbidden as a certification mechanism:

```text
missing locale → English fallback → PASS
failed assertion → warning → PASS
missing artifact → alternate artifact → PASS
failed deployment → preview URL → production PASS
```

A fallback may be valid product behavior only when the governing contract explicitly permits it and the test asserts that behavior.

---

## 19. Release Freeze

Once release verification or certification begins, unrelated source changes MUST be frozen for that certification cycle.

Any source, workflow, dependency, configuration, or contract change that can affect a required gate invalidates prior certification evidence and requires a fresh exact-SHA verification cycle.

---

## 20. Release Gate Conjunction

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
