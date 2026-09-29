# FLIXO External Agent Development Plane

Failure / RCA
  -> actionRepairBot
  -> mini-SWE-agent (sandbox-only repair worker)
  -> targeted regression / CI / browser verification
  -> CodeRabbit (independent reviewer)
  -> existing falsifier / security review
  -> existing certification authority
  -> execution / promotion

External tools are adapters over existing FLIXO roles. They do not create a second authority system.

| Adapter | Existing profile | Role | Authority |
| --- | --- | --- | --- |
| mini-SWE-agent | actionRepairBot | REPAIR_WORKER | sandbox patch candidate |
| CodeRabbit | reviewAgent | REVIEWER | read-only review |

mini-SWE-agent is manually dispatched against the current execution SHA. The worker checks the exact SHA, uses a disposable GitHub Actions workspace, emits only patch metadata and the patch artifact, and cannot push, create branches, merge, promote, or certify.

CodeRabbit is configured as an independent review layer. Its output is evidence for the existing falsifier/certification chain, not a merge or promotion decision.

External evidence is accepted only when its SHA matches the live task or mission SHA. Newer commits invalidate older evidence.
