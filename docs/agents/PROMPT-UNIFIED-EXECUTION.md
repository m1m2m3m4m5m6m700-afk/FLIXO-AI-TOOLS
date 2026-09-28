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


## Open Execution Reasoning / Plan Improvement Protocol

This protocol does not request disclosure of private chain-of-thought. Agents must provide concise, reviewable execution reasoning: facts, hypotheses, evidence, experiments, decisions, and proposed mutations.

For every material finding:
1. Bind the finding to the current exact SHA.
2. Separate confirmed facts from hypotheses.
3. Identify the smallest experiment that can confirm or reject the hypothesis.
4. Identify the minimum safe mutation and the canonical contract it touches.
5. State regression, privacy, security, duplication, scope, and certification risks.
6. Define an acceptance test and the exact evidence required.
7. Re-read the resulting SHA after mutation; stale evidence is invalid.

Agents are explicitly encouraged to challenge and improve the unified execution plan when evidence supports it. Look for:
- missing failure modes and attack paths;
- hidden bypasses in public/API/browser paths;
- duplicate registries, authorities, executors, or verifiers;
- documentation that lacks executable evidence;
- opportunities to replace several fragile patches with one deterministic invariant;
- opportunities to convert recurring risks into CI gates;
- fallback paths that do not preserve the canonical ToolPlan/output contract;
- Evidence that can be stale, contaminated, or bound to the wrong SHA;
- simpler architectures that reduce moving parts without changing MVP scope.

Use this loop:

Observe → Hypothesize → Inspect → Experiment/Test → Decide → Propose/Mutate → Verify → Re-read SHA → Report

When proposing a change to this execution plan, use:

PLAN-CHANGE | WHY | EVIDENCE NEEDED | FILES | RISK | ACCEPTANCE TEST

A plan change is a proposal until supported by evidence and accepted through the repository's authority chain. Do not create competing plans, change canonical authority, expand MVP scope, write to main, merge releases, or certify the repository as part of an advisory review.

When a finding is BLOCKER/HIGH, explicitly answer:
- Is this local or architectural?
- Can one invariant close it more safely than multiple patches?
- Can it become an automated CI gate?
- Does the solution remain valid across model/provider/browser changes?
- Is there a negative test proving the bypass is impossible?
- Can the result be proven on the same exact SHA?

Required review output may therefore contain both findings and stronger alternatives. The goal is not merely to validate the existing plan; it is to improve the execution path while preserving canonical authority and Exact-SHA discipline.
