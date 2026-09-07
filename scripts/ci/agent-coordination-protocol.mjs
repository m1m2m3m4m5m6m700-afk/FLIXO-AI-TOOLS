import { spawnSync } from 'node:child_process';

const action = process.env.FLIXO_AGENT_ACTION ?? 'status';
const args = [];
if (action === 'status') args.push();
const result = spawnSync(process.execPath, ['scripts/ci/swarm-engine.mjs', ...args], {
  stdio: 'inherit',
  env: { ...process.env, FLIXO_AGENT_ACTION: action },
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
