# FLIXO BOT — isolated OpenAI-derived runtime

## Scope

This is an isolated runtime substrate for FLIXO BOT. It adopts selected execution patterns from the supplied OpenAI Agents Python reference without importing that project as a framework.

Canonical implementation:
src/lib/agent/flixo-bot-openai-runtime.ts

Targeted regression:
scripts/ci/test-flixo-bot-openai-runtime.mjs

## Adopted patterns

- Durable RunState with schema and protocol identity.
- Explicit next-step semantics: run-again, handoff, final output, interruption.
- Tool input boundary checks with fail-closed decisions.
- Bounded retry budget; no blind retry.
- Exact-SHA freshness checks during resume and tool invocation.
- Agent-as-tool delegation without transfer of mutation or certification authority.
- Local trace/span lifecycle and append-only run events.

## Isolation constraints

This layer does not create a second planner, world model, capability registry, memory store, event store, governance plane, mutation owner, or certification authority.

It is intentionally not wired into the existing FLIXO human-facing request path. The current FLIXO planner, registry, shared memory, verification, and execution gates remain canonical.

The runtime accepts only the canonical execution work path. A changed exact SHA invalidates the run before it can resume.
