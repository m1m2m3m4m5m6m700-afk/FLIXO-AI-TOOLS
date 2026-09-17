# Auto Repair Handoff Contract v3

The repair handoff contract is canonical across the Auto Repair Bot, Handoff Gate, and Executor.

A handoff is executable only when all conditions hold:

- engine outcome is `verified-repair`
- learning outcome is `success`
- handoff mode is `VERIFIED_REPAIR`
- `applyBy` is `AUTO_REPAIR_BOT`
- `requiresCanonicalCI` is `true`
- the prepared patch and handoff evidence exist

The Handoff Gate records `READY_FOR_EXECUTION` only when every condition is true. Otherwise it records `ESCALATION_ONLY` or `NO_HANDOFF_TO_APPLY`.

No gate is bypassed and no source-run failure is converted into an executable handoff.
