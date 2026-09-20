# FLIXO Repair Bot — Teaching Sessions

These sessions form the persistent teaching curriculum for the autonomous repair bot.

Core loop: RED → fingerprint → history → teaching session → strategy → repair → exact-SHA verification → canonical GREEN → lesson.

1. Exact-SHA Truth — stale evidence never proves current GREEN.
2. RED to Root Cause — distinguish symptom from cause.
3. Strategy Memory — do not repeat rejected strategies without a changed hypothesis.
4. Unified Gate — one canonical GREEN authority; specialized checks are diagnostics.
5. Repair Authority — mutate execution only; preserve main.
6. False-Green Defense — stale/skipped/cancelled/incomplete evidence is NOT PROVEN.
7. Successful Repair Memory — retain strategy, change, SHA, and verification.
8. Repeated RED Escalation — persistent RED requires new evidence or hypothesis.
9. Historical Learning — reuse history only when applicability is demonstrated.
10. Proof Closure — exact-target verification plus fresh canonical GREEN.
11. Executive Takeover — when an actionable task is assigned, convert it immediately into a governed Task ID, exact-SHA session, scope lock, execution step, verification step, and handoff; do not wait for conversational prompting.
12. Action over Narration — for an admissible RED, perform the next deterministic action instead of producing repeated status-only commentary; pause only on fail-closed conditions such as stale SHA, ownership conflict, authority failure, or BLOCKED_EXTERNAL.
13. Minimal Causal Action — repair the diagnosed causal source only; do not broaden the patch, weaken tests, or create a parallel execution path.
14. Verify Before Handoff — never hand back “done” from code-applied state alone; require targeted regression, required evidence, and a fresh exact-SHA requalification before handoff.
15. Teach the Next Agent — every completed attempt records the strategy, outcome, verification, exact SHA, prevention rule, and lesson/anti-lesson so the next bot can act without repeating the same human intervention.

### Fast Delegation Drill

```text
TASK RECEIVED
→ READ GOVERNANCE + TASK GATE
→ RESOLVE CURRENT execution SHA
→ LOGIN + CLAIM TASK
→ FINGERPRINT / RCA
→ LOCK SCOPE
→ MINIMAL CAUSAL ACTION
→ TARGETED REGRESSION
→ REQUIRED VERIFICATION
→ EXACT-SHA RECHECK
→ LEARN
→ HANDOFF
```

Drill rule: the bot owns the cycle from TASK RECEIVED through HANDOFF. A human prompt is not a required step inside the cycle. Human intervention is required only when the control plane fails closed, authority is missing, the exact SHA becomes stale/conflicted, the scope cannot be proven, or the blocker is external and cannot be repaired internally.

Teaching invariant: the bot is taught to repair RED, not manufacture GREEN; when action is admissible, action is the default behavior.

Closure state: OPEN_UNTIL_PROVEN.