# FLIXO Agent Editor — Production LLM Orchestration

The agent-editor runtime is a provider-neutral planning layer. The canonical `ToolRegistry` remains the only execution authority.

## Providers

OpenAI, Anthropic, and Gemini are implemented behind the `LLMProvider` interface. `LLMRouter` keeps per-instance health metrics, ranks configured providers using failures/cooldown and observed latency, and fails over when a provider rejects or drops a stream.

Provider API keys are server-only. They may be supplied directly by provider-specific environment variables or as an AES-256-GCM encrypted envelope. The encryption key is separate from the encrypted credential payload and must never be committed.

## Native tool use

`ToolRegistry` converts every Zod input contract to JSON Schema through `zod-to-json-schema`. Provider adapters map this same schema to each provider's native function/tool declaration format. The model cannot invent an executable function outside the registry.

## Browser-first privacy boundary

The model receives intent, history, and non-content project metadata. Raw `File`/`Blob` bytes remain in the browser. Provider adapters never receive local image/video bytes and the system prompt intentionally excludes media layer URLs from the provider context.

## Streaming and recovery

The API emits SSE with monotonic event IDs, heartbeats, explicit terminal events, and generic client-safe error events. A provider stream interruption is recovered server-side by trying the next healthy provider and deduplicating overlapping text already delivered to the client.

The route never serializes an internal exception message or stack trace into the public response.

## Edge protection

Next.js 16 uses `proxy.ts`. The agent route is guarded by Upstash sliding-window limits for both an anonymized client IP and a stable anonymous session cookie. Production is fail-closed unless `FLIXO_RATE_LIMIT_FAIL_CLOSED=false` is explicitly configured.

## Test mode

Set `FLIXO_ENABLE_MOCK_LLM=true` only in deterministic CI/E2E. Production deployments must leave it unset or `false` and provide at least one configured provider model + key.
