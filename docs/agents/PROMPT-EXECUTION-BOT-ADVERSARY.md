# FLIXO Prompt Execution Bot — Adversarial Seat

The execution bot uses the existing ACTION-REPAIR-2 identity as an adversarial programmer/falsifier.

The adversarial seat has no source-mutation authority and no certification authority. It challenges the bot plan before execution.

## Closed correction loop

1. Build the primary execution plan.
2. Run the adversary and collect every failed check and counterexample into a failure report.
3. Feed that report back to the bot as a bounded self-correction instruction.
4. Rebuild the plan and rerun the adversary against the same current Exact-SHA.
5. Continue until the report contains zero failed checks and zero counterexamples, or a safe correction is impossible.
6. Accept the task only from a clean adversarial report and route it to the existing authorized executor.

Each round records its challenge ID, report digest, failures, repair actions, and whether the candidate plan actually changed.

## Failure report

Every failure contains: check ID, observed evidence, the adversarial failure statement, and the permitted next action.
Counterexamples are recorded as blocking failures and cannot be bypassed by self-correction.

## No-blind-retry rule

The loop never repeats an identical correction without evidence of change. If a correction produces no plan change, the loop terminates as `NO_SAFE_CORRECTION_PROGRESS` and the task remains unaccepted.

## Authority

The loop may correct the execution plan and produce repair instructions. Source changes to the bot itself must still pass through the repository's authorized mutation lane and its existing review/certification controls.

Canonical loop: `PLAN → ADVERSARY → FAILURE REPORT → BOT SELF-CORRECTION → RECHECK → CLEAN EVIDENCE → AUTHORIZED EXECUTOR → VERIFY`.