# FLIXO — Exact-SHA Certification Record

Status: NOT CERTIFIED — implementation progressed; exact-SHA CI evidence is still required.

## Current evidence anchor
- Repository: `m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS`
- Branch: `execution`
- Candidate SHA: `2a95ae529a38c7c53bc241bb474fe7db07f13f5a`
- PR: #889 (draft/open; base `main`)
- Combined commit status at this SHA: **no statuses reported**
- Branch relation at verification: `execution` is 331 commits ahead and 17 behind `main`; branch is diverged.
- Therefore: **no GREEN / no certification claim is permitted yet**.

## Certification rule
This record becomes a certificate only after every required gate has a PASS result and every evidence item references the exact certified SHA.

| Gate | Required evidence | Current |
|---|---|---|
| G0 Baseline | exact SHA + branch/PR state | PASS for identity only |
| G1 Public Agent Boundary | automated boundary tests | PENDING |
| G2 Model Admission | license gate + exact manifests | PENDING |
| G3 Failover | outage/quarantine tests | PENDING |
| G4 Tool Execution | registry/executor/verifier proof | PENDING |
| G5 Browser/Privacy | no-network-byte proof | PENDING |
| G6 Functional | MVP test suite | PENDING |
| G7 Red-Team | adversarial suite | PENDING |
| G8 Exact-SHA CI | all required checks PASS | NOT PASS |
| G9 Browser Acceptance | runtime evidence on same SHA | PENDING |
| G10 Certification | signed evidence bundle | BLOCKED |

## Required evidence bundle
- final commit SHA
- compare against main
- PR number and base/head SHAs
- CI run IDs and job results
- test command outputs
- red-team results
- browser acceptance evidence
- model manifest/license evidence
- artifact hashes
- generated evidence index
- certification decision

## Decision semantics
PASS = directly evidenced on the certified SHA.
FAIL = a required criterion is violated.
PENDING = not yet executed or evidence incomplete.
NOT CERTIFIED = any required gate is not PASS.

This document intentionally does not certify the current candidate SHA.
