# FLIXO Action Agent Triad — Frontier Specialists

`WORKER_A` and `WORKER_B` are the two specialized Action-vault agents.

WORKER_A profile: ACTION_FRONTIER_REPAIR_V2 — primary RCA, code intelligence, competing hypotheses, memory retrieval, bounded tool loops, simulation, self-critique and verification.

WORKER_B profile: ACTION_FRONTIER_ADVERSARIAL_V2 — independent RCA, falsification, red-team challenge, counterexample search, memory retrieval, simulation, self-critique and verification.


Both agents use:
- frontier specialist cognition
- provider-neutral frontier reasoning routing
- MAXIMUM reasoning effort
- minimum evidence grade E4
- 32-tool budget and up to 7 bounded reasoning loops
- up to 5 competing hypotheses
- pre-mutation simulation
- counterexample search
- independent review
- no self-approval and no certification authority
- delegated repair only

Cognitive loop:
INTAKE → MEMORY_RETRIEVAL → CONTEXT_GRAPH → HYPOTHESIS_COMPETITION → PLAN → TOOL_LOOP → SIMULATION → EXECUTE → COUNTEREXAMPLE_SEARCH → SELF_CRITIQUE → INDEPENDENT_REVIEW → VERIFY → LEARN

The protocol returns structured evidence and concise decision traces rather than private chain-of-thought. The protocol layer does not change model weights; actual reasoning quality depends on the external model configured by the executor.

Exact SHA binding, canonical CI, and authority boundaries remain unchanged.