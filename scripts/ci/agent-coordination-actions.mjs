import { execFileSync } from 'node:child_process';

const action = process.env.FLIXO_AGENT_ACTION ?? 'status';
const env = { ...process.env, FLIXO_AGENT_ACTION: action };
execFileSync(process.execPath, ['scripts/ci/agent-coordination-protocol.mjs'], { stdio: 'inherit', env });
