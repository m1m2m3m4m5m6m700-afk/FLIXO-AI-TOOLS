# FLIXO Agent Runtime — Durable Persistence

The FLIXO agent runtime keeps model reasoning advisory and execution governed by canonical runtime contracts.

The current persistence layer adds:

- Durable task snapshots in `public.flixo_agent_tasks`.
- Append-only, hash-linked task events in `public.flixo_agent_task_events`.
- Atomic event sequencing and idempotency through `flixo_append_agent_task_event`.
- Server-only Supabase credentials; anonymous and authenticated database roles receive no table privileges.
- Conversation/task identity carried from the UI into the gateway.
- Approval metadata derived from canonical capability contracts.
- An authenticated external event ingress at `/api/flixo-event`.

Runtime events are stored with the database's canonical event/source vocabulary while the original gateway event names are preserved in the event payload for traceability.

This persistence layer does not replace the existing FLIXO event gateway, layered memory, execution budget, workflow-as-tool registry, mission contract, or exact-SHA runtime governance. It extends those existing boundaries with durable state.
