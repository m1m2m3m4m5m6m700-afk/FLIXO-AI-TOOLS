# ACTION AGENT HISTORICAL MEMORY LAYER

The resident Action agents use `docs/agents/historical-action-errors/` as their durable experience layer.

Every wake, analysis step, challenge, repair decision, targeted regression result, and learning event may be recorded there under:

`docs/agents/historical-action-errors/agent-activity/`

Records are identity-bound to the exact task, fingerprint, target SHA, and failed run.

Two states are explicit:

- `PROVISIONAL`: observed during an open RED mission; useful for the current mission and future retrieval only as unverified evidence.
- `VERIFIED`: promoted only when a matching Canonical GREEN record proves the exact target SHA.

The historical Action error corpus remains observation-oriented. Agent activity enriches it with **how the agents reasoned and what they tried**, not just what failed.

Historical knowledge never overrides current evidence and never grants mutation or certification authority.
