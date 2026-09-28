# FLIXO — Engineering Contracts

## Contract A — One public agent

The only public agent surface is `FLIXO_AGENT`. Internal specialists are implementation details and cannot be selected through the public request contract.

## Contract B — Canonical registries

`TOOL_CATALOG` / capability registry is the single execution authority. Model governance is the single model-admission authority. Protocol adapters such as MCP, when introduced, must not create a competing registry.

## Contract C — Model output is data

LLM output is untrusted data. It must be parsed, schema-validated, value-validated, semantically validated and reconciled with the canonical deterministic boundary before execution.

## Contract D — Executor/Verifier separation

The component that performs an operation cannot be the sole authority that declares the operation successful. The canonical verifier must inspect the output against its contract.

## Contract E — Failure semantics

Errors use structured fields: `code`, `recoverable`, `retryable`, `suggestedAction`, and optional execution/provider/capability identity. Recovery must be bounded and explicit.

## Contract F — Idempotency

A state-changing execution has an `executionId`, `idempotencyKey`, and stable input identity. Repeating the same key/input must resolve to the same execution identity.

## Contract G — Observability privacy

Trace data records decisions and identities, not raw user file bytes or secrets. The trace must make model selection, tool selection, verification and fallback auditable.

## Contract H — Exact-SHA evidence

Evidence belongs to one exact repository state. Evidence from another SHA cannot certify the current SHA.

## Contract I — No silent capability expansion

A capability cannot become EXECUTABLE merely because a model can describe it. Admission requires canonical registry state, executor, output contract, verifier, safety limits and MVP scope compatibility.

## Contract J — License resilience

Multiple admitted model candidates reduce provider dependency but do not remove third-party license, trademark, patent, dataset, AUP or redistribution obligations. FLIXO must never claim ownership of a third-party base model without evidence.
