import { spawnSync } from 'node:child_process';

const ROOT = 'artifacts/ci/agent-coordination';
const LEDGER = `${ROOT}/events.ndjson`;
const CLAIMS = `${ROOT}/claims.json`;
const SESSIONS = `${ROOT}/active-sessions.json`;
const result = spawnSync(process.execPath, ['scripts/ci/swarm-engine.mjs', '--replay-only'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    FLIXO_SWARM_LEDGER: LEDGER,
    FLIXO_AGENT_CLAIMS_FILE: CLAIMS,
    FLIXO_AGENT_SESSIONS_FILE: SESSIONS,
  },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
