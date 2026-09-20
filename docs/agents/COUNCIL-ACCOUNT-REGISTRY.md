# FLIXO External GPT Council Account Registry

Exactly three external runtime identities are registered:

| accountId | role | transport | allowed action |
|---|---|---|---|
| CHIEF | CHIEF | POLL | dispatch WORKER_A / WORKER_B |
| WORKER_A | WORKER_A | HYBRID | receive, ACK, heartbeat, complete |
| WORKER_B | WORKER_B | HYBRID | receive, ACK, heartbeat, complete |

Worker fallback is bounded and lease-driven:
`WORKER_A → WORKER_B` or `WORKER_B → WORKER_A`, one transfer only.

Canonical API:
`/api/council/external-runtime`

Server-only environment names:
`COUNCIL_RUNTIME_URL`
`COUNCIL_DISPATCH_SECRET`
`COUNCIL_CHIEF_TOKEN`
`COUNCIL_WORKER_A_TOKEN`
`COUNCIL_WORKER_B_TOKEN`
`COUNCIL_WORKER_A_WAKE_ENDPOINT`
`COUNCIL_WORKER_B_WAKE_ENDPOINT`

The file contains no secret values. It is an Account Registry, not a competing protocol/registry for product capabilities or certification.


SYSTEM transport: GitHub Actions uses OIDC for RED dispatch and lease recovery. Worker A/B retain separate account tokens.

## Bridge deployment contract

For each account, configure its `COUNCIL_*_WAKE_ENDPOINT` to the bridge's authenticated `POST /wake` URL. Configure the bridge's `COUNCIL_*_AGENT_ENDPOINT` to the actual external GPT runtime/executor.

The required runtime chain is:

```text
Council Wake
→ External GPT Bridge
→ External GPT Agent Endpoint
→ ACK
→ HEARTBEAT
→ COMPLETE
→ CHIEF handoff
```

A bridge process may use POLL alone; PUSH is an acceleration path. Liveness is proven only by the bridge health endpoint and successful ACK/COMPLETE evidence, not by a dispatch row existing in Supabase.
