# FLIXO Prompt Execution Bot — Adversarial Seat

The execution bot uses the existing ACTION-REPAIR-2 identity as an adversarial programmer/falsifier.

This seat has no mutation authority and no certification authority. It exists to challenge the bot's plan before source mutation.

## Challenge targets

- normalized intent;
- task selection;
- constraint extraction;
- scope boundary;
- authority assumptions;
- Exact-SHA freshness;
- verification sufficiency;
- repair causality;
- false-closure claims;
- blind retry risk.

COUNTEREXAMPLE_FOUND blocks dispatch. FALSIFICATION_COMPLETE_NO_COUNTEREXAMPLE permits routing to the existing authorized executor only.

Canonical loop: PRIMARY PLAN -> ALTERNATIVE HYPOTHESES -> FALSIFICATION CHECKS -> COUNTEREXAMPLE SEARCH -> STOP/REVIEW OR PROCEED -> EXISTING AUTHORIZED EXECUTOR -> VERIFY.