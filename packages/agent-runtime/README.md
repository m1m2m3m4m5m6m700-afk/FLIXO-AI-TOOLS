# @flixo/agent-runtime

Canonical, deterministic execution lifecycle for FLIXO agents.

Responsibilities:
- enforce task identity;
- enforce explicit planning and confirmation;
- own runtime state transitions;
- register and execute runtime tools;
- return versioned execution envelopes from @flixo/contracts.

Non-responsibilities:
- UI/project state;
- model/provider integrations;
- application-specific media operations;
- persistence.

Applications adapt their existing tool and project layers to this runtime instead of creating a second lifecycle implementation.
