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
