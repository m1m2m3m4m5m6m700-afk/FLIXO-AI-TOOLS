# External GPT Runtime Adapter

Canonical endpoint: `/api/council/external-runtime`

The bridge supports:
`GET ?action=poll&accountId=CHIEF|WORKER_A|WORKER_B`
`GET ?action=handoffs` (CHIEF only)
`POST ?action=dispatch` (SYSTEM or CHIEF)
`POST ?action=ack` (own account only)
`POST ?action=heartbeat` (own account only)
`POST ?action=complete` (own account only)
`POST ?action=recover` (system only)

Every worker request is authenticated with its account token. Every mutation of task state is bound to the dispatch `entrySha`. A stale SHA is rejected by the server-side RPC.

A worker runtime should:
1. poll or receive a wake;
2. create/open its local session using the exact SHA;
3. ACK the Dispatch with `accountId + sessionId + entrySha`;
4. heartbeat before lease expiry while working;
5. complete with `DONE|FAILED + evidence + payload`;
6. handoff returns to CHIEF through `HANDOFF_READY`.

The repository cannot directly inject instructions into another ChatGPT UI account. Each ChatGPT account therefore needs an external runtime/bridge capable of polling this endpoint or exposing the configured push endpoint. The bridge is the only missing provider-side component.


The Edge Function audience is `https://zrpsmgdrtwzrhkjwwujo.supabase.co/functions/v1/flixo-council-runtime` and validates the repository/workflow context before accepting SYSTEM operations.

## External GPT Bridge — implemented provider-side component

The repository now contains `scripts/council/external-gpt-bridge.mjs`.

The bridge is the provider-side runtime component. Run one persistent instance per external council account (`CHIEF`, `WORKER_A`, `WORKER_B`). It supports polling and push wake-up:

- `GET /health` for liveness.
- `POST /wake` for authenticated push wake.
- background polling of the canonical runtime.
- exact-SHA validation.
- ACK immediately after claiming a dispatch.
- heartbeat while the external executor is working.
- COMPLETE with `DONE` or `FAILED` plus evidence.
- no completion without a real executor response.

Configure the bridge with the account token, a private `COUNCIL_*_AGENT_ENDPOINT`, and matching `COUNCIL_*_AGENT_TOKEN`. The agent endpoint is the provider-specific adapter that actually opens or invokes the external GPT account/runtime. FLIXO does not fabricate provider access and does not claim a GPT account is live until that endpoint responds.

Example:

```text
CHIEF bridge       → CHIEF_AGENT_ENDPOINT
WORKER_A bridge    → WORKER_A_AGENT_ENDPOINT
WORKER_B bridge    → WORKER_B_AGENT_ENDPOINT
        ↓
/api/council/external-runtime
        ↓
ACK → HEARTBEAT → COMPLETE
```

The bridge is provider-agnostic so it can connect to an external GPT runtime, private agent gateway, or equivalent account-side adapter without adding a second council protocol.
