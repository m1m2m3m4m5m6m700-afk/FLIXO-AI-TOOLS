# FLIXO Agent Runtime — Platform Extensions

This document records the runtime extensions implemented from the FLIXO agent-platform analysis.

## Implemented

- Unified event gateway sources remain canonical: user message, file upload, schedule, webhook, tool result, and system.
- Workflow-as-a-Tool now exposes canonical step parameter references, canonical output contracts, derived risk, and confirmation requirements without introducing a second registry.
- Layered memory and durable task state continue to use the existing task/memory contracts.
- Approval remains derived from canonical capability execution mode and network policy.
- Execution budgets remain enforced by the existing runtime budget contract.
- A provider-neutral schedule runtime validates ONCE, INTERVAL, and CRON definitions and emits canonical SCHEDULE events. CRON timing itself remains the responsibility of the deployment scheduler; the event gateway is the runtime boundary.
- A universal ingestion runtime provides the canonical INGEST -> NORMALIZE -> FILTER -> UNDERSTAND -> TRANSFORM -> VERIFY -> DELIVER pipeline with stage and output budgets.
- Durable task replay is exposed through the existing Supabase task store by loading the task snapshot together with its append-only event chain.
- The existing FLIXO BOT runtime remains the execution substrate for bounded turns, approvals, exact-SHA freshness, retries, trace spans, and resume.

## Authority boundaries

The LLM remains advisory. Workflow metadata, canonical capabilities, execution-gate policy, output contracts, task state, and exact-SHA runtime checks remain authoritative.

No n8n dependency was introduced into the FLIXO runtime.

## Operational note

The runtime supports schedule-triggered agent execution through the canonical event gateway. An actual recurring clock must be supplied by the deployment environment that owns the /api/flixo-event ingress; the code intentionally does not create a second scheduler or an implicit privileged execution path.

## Verification

New tests cover workflow-tool metadata, schedule event creation/due evaluation, ingestion stage composition and budgets, and durable replay API availability.