# FLIXO Browser Observation Skill

## Purpose
Turn browser runtime behavior into structured diagnostic evidence.

## Rules
- Observe before assuming.
- Capture console errors, page errors, failed requests, failed HTTP responses, document landmarks, locale/direction, and navigation timing.
- Normalize evidence to omit query strings/fragments where they can carry transient or sensitive values.
- Bind every observation to taskId, traceId, and the exact execution SHA.
- Treat missing exact-SHA identity in CI as a failed evidence state.
- Browser observation is READ-only. Never mutate the page to make a test pass.
- Use observation to explain failures and decide whether to retry or replan; it is not a certification authority.
