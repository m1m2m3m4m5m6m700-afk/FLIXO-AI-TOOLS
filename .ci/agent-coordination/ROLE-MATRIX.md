# Agent Collaboration Role Matrix

| Role | Write Authority | Required Inputs | Allowed Outputs | Certification |
|---|---|---|---|---|
| Planner | No | repository state, contracts, RCs | scope packets, priorities | No |
| Writer | Claimed scope only | exact SHA + active claim | commits, evidence | No |
| Diagnostic | None | exact SHA | findings, RC IDs | No |
| Verifier | Evidence-only | exact SHA + artifacts | verification verdict | No |
| Handoff Coordinator | Coordination metadata only | claims + packets | handoff state | No |
| Full Matrix | Read/execute certification scope | exact plan/inventory/results | canonical release verdict | Yes |

A role can never grant another role more authority than its row allows. A claim authorizes repository writes only inside the exact claimed scope. A successful local test never grants certification authority.
