# FLIXO — Single Public Agent / Internal Specialist Routing

The user-facing surface is exactly one agent: **FLIXO Agent**.

Users do not select, invoke, or address internal specialist agents directly. FLIXO Agent owns interpretation, authorization, model selection, tool planning, execution, and final response.

Internal specialists are implementation details selected by the FLIXO Agent only when the request requires a materially different reasoning lens. Their result is returned to FLIXO Agent for synthesis and verification.

Routing invariant:

User → FLIXO Agent → optional internal specialist → FLIXO Agent → canonical ToolPlan/Executor/Verifier → User

No user-visible specialist identity is an execution API. A direct specialist identifier must fail closed.

This reduces unnecessary dependence on specialized agent interfaces and keeps the application contract stable when providers, models, licenses, or specialist implementations change. It does **not** remove licensing obligations for any third-party model or agent implementation that is actually used; every runtime dependency remains subject to its applicable license/policy gate.

The pattern follows the manager-style architecture in which a central agent controls access to specialized capabilities while retaining the user-facing interaction.