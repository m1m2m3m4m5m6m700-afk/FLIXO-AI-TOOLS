#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const exists = (f) => fs.existsSync(path.resolve(root, f));
const read = (f) => fs.readFileSync(path.resolve(root, f), 'utf8');
const required = {
  'scripts/ci/agent-coordination.mjs': ['task-create','task-claim','task-release','task-complete','ingest-handoff','COORDINATION_CONFLICT'],
  'docs/AGENT-COORDINATION-CONTROL-PLANE.md': ['coordination-state.json','coordination-locks.json','task-packets','dependencies','RCA'],
  'diagnostics/agents/coordination-state.json': ['AGENT_COORDINATION_CONTROL_PLANE','tasks','activeSessions'],
  'diagnostics/agents/coordination-locks.json': ['AGENT_SCOPE_LOCKS','locks'],
};
for (const [file, markers] of Object.entries(required)) {
  if (!exists(file)) { failures.push(`MISSING=${file}`); continue; }
  const text = read(file);
  for (const marker of markers) if (!text.includes(marker)) failures.push(`MISSING_MARKER=${file}:${marker}`);
}
const pkg = exists('package.json') ? JSON.parse(read('package.json')) : { scripts: {} };
for (const script of ['agent:coordination','validate:agent-coordination']) if (typeof pkg.scripts?.[script] !== 'string') failures.push(`PACKAGE_SCRIPT_MISSING=${script}`);
const protocol = exists('docs/AGENT-COLLABORATION-PROTOCOL.md') ? read('docs/AGENT-COLLABORATION-PROTOCOL.md') : '';
for (const marker of ['Central coordination control plane','diagnostics/agents/coordination-state.json','scripts/ci/agent-coordination.mjs']) if (!protocol.includes(marker)) failures.push(`PROTOCOL_MISSING=${marker}`);
const agents = exists('AGENTS.md') ? read('AGENTS.md') : '';
for (const marker of ['COORDINATION CONTROL PLANE','agent-coordination.mjs','task-claim']) if (!agents.includes(marker)) failures.push(`AGENTS_MISSING=${marker}`);
const result = { schemaVersion: 1, authority: 'AGENT_COORDINATION_GUARD', status: failures.length ? 'FAIL' : 'PASS', failures };
fs.mkdirSync(path.resolve(root, 'diagnostics/agents'), { recursive: true });
fs.writeFileSync(path.resolve(root, 'diagnostics/agents/coordination-validation.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
