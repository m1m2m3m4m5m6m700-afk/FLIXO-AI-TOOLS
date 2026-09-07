# Agent Handoff Packet

```yaml
protocol: FLIXO-agent-handoff-v1
agentId: <outgoing-agent>
fromBranch: <agent-branch>
fromSha: <exact-40-char-sha>
status: handoff-pending
targetAgentId: <incoming-agent>
objective: <one-sentence objective>
scope:
  paths: []
  contracts: []
  rootCauseIds: []
changes:
  committed: []
  uncommitted: []
verification:
  commands: []
  evidence: []
blockers: []
knownRisks: []
requiredNextAction: <exact next action>
safeToContinue: true
```

A handoff is not complete until the outgoing claim is `handoff-pending`, the incoming agent has independently checked in against its own exact SHA, and collision validation passes.
