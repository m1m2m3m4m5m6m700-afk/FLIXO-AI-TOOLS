# FLIXO Verification Cycle

This marker starts a fresh verification cycle on the execution to main lane.

Cycle rule:
- Previous workflow results are not reused as GREEN evidence for the new HEAD.
- Every required workflow must report success for the same Exact-SHA.
- Certification must bind to that Exact-SHA.
- Live Council runtime evidence must come from the protected live-runtime verification workflow for that Exact-SHA.
- Any drift, missing evidence, or external-only signal keeps promotion blocked.

Started: 2026-09-20T00:00:00Z