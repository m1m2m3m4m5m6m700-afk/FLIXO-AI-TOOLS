# FLIXO — Exact-SHA Certification Record

Status: NOT CURRENT CERTIFICATION

This document is a control-plane policy/evidence record. It must never be interpreted as certification merely because CI evidence exists.

## Exact-SHA handling

The authoritative candidate SHA MUST be obtained from the current PR #923 head and matched against every required CI/security/test artifact. This file intentionally does not self-embed a candidate SHA because changing the file would create a new commit and invalidate the evidence it attempted to describe.

Authoritative integration path:
- Repository: m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS
- Integration PR: #923
- Execution -> main only
- Direct main mutation: none

Required evidence includes:
- typecheck/lint/core tests/build
- Chromium browser smoke
- trust-gate
- Exact-SHA promotion proof
- Agent Editor STEP 4
- Agent Editor Step 5-6
- internal exact-SHA coverage
- CodeQL
- Secret Scan/Gitleaks
- clean-clone Red Team
- deployment identity when applicable

Certification blockers remain:
- Main governance ruleset does not currently require approvals/Code Owner review or strict required checks.
- Model admission manifest currently contains zero admitted production models.
- Prompt 17, release candidate freeze, Prompt 19 exact-SHA certification, and owner-authorized execution->main promotion remain pending.

Certification state: NOT_READY.
