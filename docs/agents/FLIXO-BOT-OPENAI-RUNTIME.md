# FLIXO BOT — OpenAI-derived runtime integration

The isolated runtime is now a real execution substrate for the existing FLIXO BOT gateway.

Canonical flow:

\`request → RunState → model turn trace → existing FLIXO planner/contract validation → final/approval state → response\`

The integration deliberately keeps these existing components authoritative:

- FLIXO deterministic planner and execution-plan contract.
- Existing capability registry and tool definitions.
- Existing shared operational memory.
- Existing execution/verification gates.
- Existing mutation and certification boundaries.

The new runtime contributes:

- exact-SHA-bound RunState;
- explicit run lifecycle state;
- bounded provider retry accounting;
- model/tool-style trace spans;
- fail-closed runtime boundaries;
- serializable resume state returned with every gateway response;
- \`WAITING_APPROVAL\` for plan responses rather than falsely marking a plan as executed;
- no authority transfer from Agent-as-tool / handoff semantics.

No second planner, memory, event store, capability registry, governance plane, or mutation authority was introduced.


Approval is transactional rather than a UI-only transition:

`WAITING_APPROVAL -> approvalId match -> canonical event-chain replay check -> APPROVAL_ACCEPTED event persistence -> EXECUTING`

The approval identifier is bound to the runtime state and exact SHA. A mismatched identifier, a stale SHA, a corrupt conversation-event chain, a replayed approval, or failed event persistence blocks execution closed.

The approval ledger reuses the existing hash-linked conversation event store; no second persistence or memory system is introduced. The browser session can therefore resume plan/approval metadata without persisting user image bytes. Because the image input itself remains a local `File`, a browser reload cannot reconstruct an already-running image mutation from metadata alone; resumability is intentionally limited to the pre-execution approval boundary.

Canonical test coverage remains inside the repository's existing test surfaces so the governance plane does not require adding parallel standalone test registries while canonical GREEN is pending.
