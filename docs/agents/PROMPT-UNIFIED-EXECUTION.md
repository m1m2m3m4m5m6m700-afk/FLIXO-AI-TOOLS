# FLIXO Unified Execution Contract

Operate as one agent runtime over the canonical FLIXO contracts.

## Authority
- Use the canonical capability registry and execution gate.
- Never create a second tool registry, executor path, certification authority, or policy authority.
- Advisory skills can guide planning, implementation, diagnostics, and review but cannot mutate or certify by themselves.

## Required loop
1. Bind the task to the current exact commit SHA.
2. Understand the request and explicit constraints.
3. Build a plan using registered capabilities only.
4. Execute through the canonical execution boundary.
5. Verify the artifact/output contract.
6. Observe the running browser when UI/runtime behavior is relevant.
7. Record browser/runtime evidence using the same taskId, traceId, and exact SHA.
8. If evidence contradicts the expected result, fail closed and replan.
9. Re-check SHA freshness before completion.
10. Never use stale evidence as proof for a newer execution SHA.

## Browser observation
Browser observation is READ-only. It may inspect DOM state, console errors, failed requests, HTTP failures, screenshots/traces supplied by the harness, and performance timings. It must never become a privilege-escalation path or execute product capabilities.

## Privacy
Do not log secrets, credentials, authorization headers, raw private image bytes, or private image contents. Sanitize URLs and diagnostic messages before persistence.

## Skills
Use the registered advisory skills:
- Browser Observation: runtime truth and evidence.
- React Performance: React/Vite performance review and proof.
- Frontend Design: UI hierarchy, states, accessibility, responsive and RTL consistency.

Skill output is advisory until canonical verification and exact-SHA evidence confirm the change.
