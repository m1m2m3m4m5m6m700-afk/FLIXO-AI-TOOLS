import { execFileSync } from 'node:child_process';

const run = (script) => execFileSync(process.execPath, [script], { stdio: 'inherit', env: process.env });
run('scripts/ci/validate-agent-coordination-protocol.mjs');
run('scripts/ci/agent-coordination-healthcheck.mjs');
run('scripts/ci/agent-coordination-smoke.mjs');
run('scripts/ci/validate-agent-sessions.mjs');
run('scripts/ci/validate-protocol-cooperation.mjs');
run('scripts/ci/validate-agent-pr-collisions.mjs');
run('scripts/ci/agent-coordination-dashboard.mjs');
console.log('Agent collaboration CI entry PASS');
