import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['scripts/ci/swarm-engine.mjs', '--replay-only'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    FLIXO_SWARM_LEDGER: process.env.FLIXO_SWARM_LEDGER ?? 'artifacts/ci/agent-coordination/events.ndjson',
    FLIXO_AGENT_CLAIMS_FILE: process.env.FLIXO_AGENT_CLAIMS_FILE ?? 'artifacts/ci/agent-coordination/claims.json',
    FLIXO_AGENT_SESSIONS_FILE: process.env.FLIXO_AGENT_SESSIONS_FILE ?? 'artifacts/ci/agent-coordination/active-sessions.json',
  },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
