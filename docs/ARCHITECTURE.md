# FLIXO Architecture

FLIXO is a React + Vite + TypeScript application. The built `dist` directory is deployable through Wrangler and remains compatible with the existing Vercel Vite deployment.

```text
Browser
  |
  +-- Router
  |     +-- localized pages
  |     +-- tool pages
  |     +-- agent UI
  |
  +-- src/lib
  |     +-- i18n
  |     +-- routing
  |     +-- seo
  |     +-- agent
  |
  +-- src/tools
  |     +-- isolated tool engines
  |
Server
  |
  +-- api/flixo-agent.ts
  +-- api/admin/*
  +-- src/server/*
  +-- Supabase persistence
```

The main contracts are deliberately small:

1. `src/lib/i18n/config.ts` owns canonical locale identity.
2. `src/lib/routing/route-resolver.ts` owns localized tool paths.
3. `src/lib/seo` derives canonical URLs and alternate-language metadata from the same route/locale source.
4. Image upload safety is checked before expensive browser processing.
5. Mathematical expressions are parsed by a deterministic grammar; arbitrary JavaScript evaluation is forbidden.
6. Tools remain isolated under `src/tools`.

Locale dictionaries and heavyweight optional tools are lazy-first. The initial shell must not import every locale or expensive engine.

Verification is provided by TypeScript, ESLint, deterministic core contracts, production build output, and Playwright browser tests. Generated diagnostics and autonomous repair systems are not release authorities.


## Agent Runtime Platform

The agent runtime is event-driven rather than chat-only. Inputs are normalized into a canonical event envelope and then routed through conversation/task context, model selection, planning, capability/workflow contracts, policy, execution, verification, and durable trace state.

\`\`\`text
User/File/Webhook/Schedule/Tool/System Event
                    |
                    v
             Event Gateway
                    |
                    v
        Conversation + Task State
                    |
                    v
              Model Router
                    |
                    v
              Planner/Agent
                    |
             +------+------+
             |             |
        Capability    Workflow-as-Tool
             |             |
             +------+------+
                    |
                    v
            Approval Policy
          AUTO / CONFIRM / BLOCK
                    |
                    v
          Bounded Execution Gate
                    |
                    v
              Executor
                    |
                    v
          Verifier + Receipts
                    |
                    v
        Durable Task/Event Store
          Trace + Replay + Resume
\`\`\`

### Durable runtime

\`public.flixo_agent_tasks\` stores task state and runtime snapshots. \`public.flixo_agent_task_events\` stores the append-only event chain with sequence numbers, idempotency keys, previous hashes, and current hashes. The runtime can therefore be resumed from serialized state and audited independently of chat history.

### Workflow-as-a-Tool

Workflows are derived from the canonical workflow registry and exposed as first-class tool contracts. Each descriptor carries its workflow steps, input/output contract metadata, aggregate risk level, and confirmation requirement. Workflow expansion still terminates at the canonical deterministic execution plan.

### Layered memory

Memory remains advisory and bounded. Task state, conversation context, user/project memory, and verified knowledge are kept as distinct evidence-bearing layers rather than one undifferentiated message buffer.

### Scheduled and event-driven execution

Persistent schedules live in \`public.flixo_agent_schedules\`. Due schedules are claimed with a database lock/lease to prevent duplicate concurrent execution. \`/api/flixo-scheduler\` invokes the canonical agent gateway, and Vercel Cron provides a production scheduler tick.

### Universal ingestion

\`src/lib/agent/ingestion-pipeline.ts\` provides a transport-neutral normalization pipeline for web, PDF, image, video, RSS, API, database, GitHub, user-file, and conversation sources. Understanding, transformation, verification, and delivery are explicit stages and do not own transport-specific credentials.

### Budgets and replay

Execution budgets enforce step, tool-call, retry, elapsed-time, output, model-token, and cost ceilings. Runtime traces can be serialized/restored, while event histories can be replay-validated before being treated as trustworthy.
