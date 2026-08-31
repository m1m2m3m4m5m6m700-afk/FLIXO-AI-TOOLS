# G3 Root-Cause Sweep

## Purpose

G3 is validated as a complete artifact-integrity gate before merge. Failures are grouped by root cause rather than fixed one test at a time.

## Required behavior

- Do not weaken G3 assertions.
- Do not add skip/allowlist exceptions for deterministic failures.
- Do not increase timeouts as a substitute for fixing the cause.
- Browser upload failures must be diagnosed at the application/file-input lifecycle level.
- All G3 contract families must be run together for final verification.

## G3 verification matrix

1. Output exists
2. Output type
3. Output signature
4. Byte integrity
5. SHA
6. Download
7. Filename
8. Corruption handling
9. Real browser upload/process/download flow
10. Multi-file/edge-input flow

## Root-cause rule

A repeated failure with the same underlying cause is one root cause, even when it produces multiple test failures. Fix the root cause first, then rerun the smallest complete G3 verification set.

## Merge protection

G3 must run for pull requests targeting `main`. A PR must not be merged based only on unrelated checks when required G3 contracts have not passed.
