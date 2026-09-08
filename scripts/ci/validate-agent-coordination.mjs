#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const failures = [];
const read = (file) => fs.readFileSync(path.resolve(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.resolve(root, file));
const expected = {
  'scripts/ci/agent-coordination.mjs': ['task-create', 'task-claim', 'task-release', 'task-complete', 'ingest-handoff', 'COORDINATION_CONFLICT'],
  'diagnostics/agents/coordination-state.json': ['AGENT_COORDINATION_CONTROL_PLANE', 'tasks', 'activeSessions'],
  'diagnostics/agents/coordination-locks.json': ['AGENT_SCOPE_LOCKS', 'locks'],
  'docs/AGENT-HANDOFF-REPORT-SCHEMA.md': ['completedWork', 'failedWork', 'remainingWork', 'executionPlanNext', 'handoffToNextAgent'],
  'docs/AGENT-COLLABORATION-PROTOCOL.md': ['Multi-Agent', 'handoff', 'scope', 'RCA'],
};
for (const [file, markers] of Object.entries(expected)) {
  if (!exists(file)) { failures.push(`MISSING=${file}`); continue; }
  const text = read(file);
  for (const marker of markers) if (!text.includes(marker)) failures.push(`MISSING_MARKER=${file}:${marker}`);
}
const packageJson = exists('package.json') ? JSON.parse(read('package.json')) : { scripts: {} };
if (typeof packageJson.scripts?.['validate:agent-coordination'] !== 'string') failures.push('PACKAGE_SCRIPT_MISSING=validate:agent-coordination');
if (typeof packageJson.scripts?.['agent:coordination'] !== 'string') failures.push('PACKAGE_SCRIPT_MISSING=agent:coordination');
const state = exists('diagnostics/agents/coordination-state.json') ? JSON.parse(read('diagnostics/agents/coordination-state.json')) : null;
const locks = exists('diagnostics/agents/coordination-locks.json') ? JSON.parse(read('diagnostics/agents/coordination-locks.json')) : null;
if (state?.schemaVersion !== 1) failures.push('STATE_SCHEMA_INVALID');
if (locks?.schemaVersion !== 1) failures.push('LOCK_SCHEMA_INVALID');
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const result = {
  schemaVersion: 1,
  authority: 'AGENT_COORDINATION_GUARD',
  status: failures.length ? 'FAIL' : 'PASS',
  checkedSha: sha,
  controlPlane: 'scripts/ci/agent-coordination.mjs',
  state: 'diagnostics/agents/coordination-state.json',
  locks: 'diagnostics/agents/coordination-locks.json',
  failures,
};
fs.mkdirSync(path.resolve(root, 'diagnostics/agents'), { recursive: true });
fs.writeFileSync(path.resolve(root, 'diagnostics/agents/coordination-validation.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
