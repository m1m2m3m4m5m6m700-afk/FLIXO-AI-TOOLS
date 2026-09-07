import { spawnSync } from 'node:child_process';

const result = spawnSync(process.execPath, ['scripts/ci/swarm-engine.mjs', '--sweep'], {
  stdio: 'inherit',
  env: { ...process.env, FLIXO_AGENT_ACTION: 'sweep' },
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
