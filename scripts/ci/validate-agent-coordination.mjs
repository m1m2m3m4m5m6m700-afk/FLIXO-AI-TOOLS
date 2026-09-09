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
  'docs/AGENT-HANDOFF-REPORT-SCHEMA.md': ['completedWork', 'failedWork', 'remainingWork', 'executionPlanNext', 'handoffToNextAgent'],
  'docs/AGENT-COLLABORATION-PROTOCOL.md': ['Multi-Agent', 'handoff', 'scope', 'RCA'],
};

for (const [file, markers] of Object.entries(expected)) {
  if (!exists(file)) {
    failures.push(`MISSING=${file}`);
    continue;
  }
  const text = read(file);
  for (const marker of markers) {
    if (!text.includes(marker)) failures.push(`MISSING_MARKER=${file}:${marker}`);
  }
}

const packageJson = exists('package.json') ? JSON.parse(read('package.json')) : { scripts: {} };
if (typeof packageJson.scripts?.['validate:agent-coordination'] !== 'string') failures.push('PACKAGE_SCRIPT_MISSING=validate:agent-coordination');
if (typeof packageJson.scripts?.['agent:coordination'] !== 'string') failures.push('PACKAGE_SCRIPT_MISSING=agent:coordination');

for (const [file, authority, collection] of [
  ['diagnostics/agents/coordination-state.json', 'AGENT_COORDINATION_CONTROL_PLANE', 'tasks'],
  ['diagnostics/agents/coordination-locks.json', 'AGENT_SCOPE_LOCKS', 'locks'],
]) {
  if (!exists(file)) continue;
  try {
    const value = JSON.parse(read(file));
    if (value?.schemaVersion !== 1) failures.push(`STATE_SCHEMA_INVALID=${file}`);
    if (value?.authority !== authority) failures.push(`STATE_AUTHORITY_INVALID=${file}`);
    if (!value?.[collection] || typeof value[collection] !== 'object' || Array.isArray(value[collection])) {
      failures.push(`STATE_COLLECTION_INVALID=${file}:${collection}`);
    }
  } catch {
    failures.push(`STATE_JSON_INVALID=${file}`);
  }
}

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const result = {
  schemaVersion: 1,
  authority: 'AGENT_COORDINATION_GUARD',
  status: failures.length ? 'FAIL' : 'PASS',
  checkedSha: sha,
  controlPlane: 'scripts/ci/agent-coordination.mjs',
  runtimeStatePolicy: 'generated-and-ignored',
  state: 'diagnostics/agents/coordination-state.json',
  locks: 'diagnostics/agents/coordination-locks.json',
  failures,
};

fs.mkdirSync(path.resolve(root, 'diagnostics/agents'), { recursive: true });
fs.writeFileSync(path.resolve(root, 'diagnostics/agents/coordination-validation.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
