# FLIXO — 10,000-Run RCA Synthesis and Zero-Stall Repair Doctrine

Teaching packet: TEACHING-10K-RCA-20260925
Evidence window: 2026-09-23T22:29:00Z -> 2026-09-24T22:32:00Z
Corpus: 10,000 GitHub Actions runs
Status: PROVISIONAL HISTORICAL TEACHING / ADVISORY
Authority: knowledge only; never mutation or certification authority
Exact-SHA rule: historical evidence cannot certify a newer SHA

## 1. Core lesson

A large CI failure count is a symptom population, not a root-cause count.

The repair bot must not reason as: run failed -> workflow is root cause -> patch workflow.

It must reason as: run -> classify state -> verify exact SHA -> find first failing step -> build causal chain -> identify canonical owner -> targeted falsification -> repair -> fresh exact-SHA verification.

The 10,000-run retrospective concentrated the causal families around exact-SHA drift/supersession, proof coverage, provider/runtime availability, wake/continuity semantics, downstream propagation, diagnostic-vs-execution separation, real application/browser/test defects, and repair-loop convergence.

## 2. Mandatory classification gate

| Class | Meaning | Default action |
|---|---|---|
| SUPERSEDED | Old SHA was intentionally replaced | Do not repair old target |
| STALE | Evidence no longer matches live head | Invalidate proof; refresh head |
| EXTERNAL | Provider/runtime failure | Record BLOCKED_EXTERNAL; recheck |
| DOWNSTREAM | Gate reflects upstream RED | Trace upstream |
| CONTRACT | Canonical contract/proof mismatch | Repair contract owner |
| INTERNAL | Source/runtime defect in repository | Reproduce and repair |
| UNKNOWN | Evidence insufficient | Collect discriminating evidence; fail closed |

Never silently convert UNKNOWN into a guessed root cause.

## 3. Exact-SHA discipline

Capture the exact target SHA at admission, confirm it before mutation, and bind every verification artifact to the post-mutation SHA.

Rules: LIVE_HEAD_MOVED or LIVE_HEAD_MATCH=0 means current proof is stale; a new commit invalidates prior exact-SHA evidence; historical GREEN is historical evidence only; stale security review is not a security vulnerability; cancelled old runs are not current RED merely because their conclusion is cancelled.

## 4. First-causal-failure algorithm

When several workflows are RED on one SHA: dependency order > workflow name > failure count.

Procedure: find the earliest failing canonical gate; record the first failing step; determine owner and inputs; verify which later REDs depend on it; repair only the causal owner; run the narrowest falsifying regression; then run the broad matrix.

Example: WP0 RED -> Merge Gate RED -> Certification RED. Do not patch all three. First prove whether WP0 is causal.

## 5. Cancellation and wake semantics

Watchdog reasoning must distinguish superseded cancellation from unexpected loss of the canonical test start.

For any cancellation inspect: cancellation reason + replacement SHA + replacement run + exact-head state + canonical test-start evidence.

Only wake or re-dispatch when evidence shows that the canonical current-SHA obligation was lost unexpectedly.

## 6. External runtime failures

A 503, provider refusal, or external model/runtime outage is not an invitation to edit unrelated application code.

Correct loop: capture signature -> classify BLOCKED_EXTERNAL -> preserve evidence -> recheck provider -> resume when the dependency recovers.

A stale external security review is different from a discovered vulnerability.

## 7. Diagnostic contract vs execution outcome

A diagnostic or reducer contract can pass while the execution graph remains RED. Preserve both dimensions: diagnostic-tool health and system execution outcome.

Never collapse diagnostic-contract PASS into system PASS.

## 8. Proof coverage

Sensitive mutations require a proof chain: mutation -> target SHA -> proof producer -> runtime evidence -> regression -> certification owner.

A sensitive commit without its required proof is a real contract/proof defect. Repair the proof-producing boundary instead of silencing the guard.

## 9. Convergence and zero-stall behavior

The bot must never stall because a RED is ambiguous.

On ambiguity, advance by a discriminating action: refresh SHA, inspect first failing step, classify provider/control-plane state, run a targeted probe, compare hypotheses, or escalate.

Never repeat the same failed repair unchanged, mutate from weak resemblance, wait indefinitely without a next diagnostic action, or promote historical evidence to current proof.

Repeated identical RED is evidence against the current repair strategy.

## 10. Root-cause clustering

workflow failures are not root causes.

Cluster by failure fingerprint + workflow role + exact-SHA lineage + first failing step + dependency path + provider signature.

Event volume prioritizes investigation; it does not create a number of roots.

Therefore 1,584 failures must not be interpreted as 1,584 independent bugs.

## 11. Repair loop

OBSERVE -> CLASSIFY -> EXACT-SHA CHECK -> FIRST-FAILURE SEARCH -> HYPOTHESIS SET -> DISCRIMINATING PROBE -> ROOT OWNER -> MINIMAL MUTATION -> TARGETED REGRESSION -> FRESH EXACT-SHA VERIFICATION -> BROAD REGRESSION -> LEARN / ANTI-LEARN.

If a hypothesis is falsified, record the failed reasoning path as an anti-lesson. If a repair succeeds only on a stale target, it is not a current success.

## 12. Learning promotion

Historical synthesis is advisory. Historical or proposed knowledge can guide search order. VERIFIED or PROMOTED knowledge requires canonical GREEN and exact-SHA evidence. Knowledge never grants mutation or certification authority. Contradictory evidence remains visible until current exact-SHA evidence resolves it.

## 13. Compact decision card

1. Is the target SHA still live?
2. Was the run cancelled because it was superseded?
3. What was the first failing step?
4. Is this INTERNAL, STALE, EXTERNAL, DOWNSTREAM, CONTRACT, RUNTIME, or UNKNOWN?
5. Which later failures depend on it?
6. What single probe distinguishes the leading hypotheses?
7. What is the canonical owner?
8. What is the smallest mutation?
9. What targeted regression falsifies the RCA?
10. What fresh exact-SHA evidence closes the loop?
11. What lesson prevents the same recurrence?

This decision card is the default cognitive route for future 10k-scale failure populations.
