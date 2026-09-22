# Repair Bot Teaching Session — 2026-09-22

## Verified incident
- Workflow: `FLIXO Repair Agent — Error Intake Gateway`
- Failed run: `35691295313`
- Target SHA: `5f340c4338abbfca299223309544946e97d9ccb2`
- Root cause: transient GitHub API installation rate limit (`HTTP 403: API rate limit exceeded for installation`) during `gh run view` in the intake gateway.

## Corrective action
- Added bounded exponential retry wrapper (`2s, 4s, 8s, 16s`, max 5 attempts) around read-only GitHub API calls used to resolve scheduled or workflow-run evidence.
- Preserved fail-closed semantics: after the bounded retry budget is exhausted, the job still fails and no incident is synthesized from missing or stale evidence.
- No mutation authority was added; `main` remains immutable and issue `#761` remains archived/non-activating.

## Lesson
A transient control-plane/API failure is not proof of a code defect and must not be converted into false GREEN or false RED. Retry only the read-only evidence acquisition step, preserve exact-SHA checks, and fail closed when the evidence cannot be retrieved.

## Promotion rule
This lesson is operationally recorded but is not promoted to Canonical GREEN knowledge until a fresh execution SHA completes the canonical required checks and Green Gate evidence.
