# FLIXO Agent Command Catalog

القائمة تشير إلى التنفيذ الموجود ولا تنشئ implementation ثانية.

## Session
node scripts/ci/agent-session.mjs login --session=<id> --agent=<id> --task=<task-id> --role=<role> --rca=<RCA-ID> --scope=<scope>
node scripts/ci/agent-session.mjs logout --session=<id> --agent=<id> --status=VERIFIED|BLOCKED --final-summary=<final-outcome>

## Coordination
node scripts/ci/agent-coordination.mjs brief
node scripts/ci/agent-coordination.mjs task-create ...
node scripts/ci/agent-coordination.mjs task-claim --task=<id> --session=<id> --agent=<id>
node scripts/ci/agent-coordination.mjs task-release ...
node scripts/ci/agent-coordination.mjs task-complete ...
node scripts/ci/agent-coordination.mjs ingest-handoff ...
node scripts/ci/agent-coordination.mjs state
node scripts/ci/agent-coordination.mjs visible

## Repair/Liveness
node scripts/ci/repair-protocol.mjs validate
node scripts/ci/repair-protocol.mjs commit-gate --evidence=<file>
node scripts/ci/repair-protocol.mjs post-commit --evidence=<file>
node scripts/ci/agent-liveness-protocol.mjs validate
node scripts/ci/agent-liveness-protocol.mjs check-heartbeat --state=<state> --last=<timestamp>
node scripts/ci/agent-liveness-protocol.mjs check-progress --state=<state> --last=<timestamp> --count=<n>

## Prompt/validation
node scripts/ci/prompt-registry.mjs validate
node scripts/ci/validate-prompt-registry.mjs
node scripts/ci/error-teaching-router.mjs "<failure-class or fingerprint>"
node scripts/ci/validate-agent-protocol.mjs
node scripts/ci/validate-agent-coordination.mjs
node scripts/ci/validate-agent-recovery-gate.mjs
node scripts/ci/validate-task-agent-contract.mjs
node scripts/ci/run-static-preflight.mjs