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
