# @flixo/contracts

Canonical, runtime-neutral contracts for communication between FLIXO applications and the Agent Runtime.

Ownership rules:

- Applications own UI state and presentation.
- @flixo/contracts owns cross-application message and execution envelopes.
- The canonical Agent Runtime will consume these contracts.
- Tool implementations must not be placed in this package.
- No contract may depend on an application package.

Migration rule:


1.0.0 is the initial stable envelope version.
