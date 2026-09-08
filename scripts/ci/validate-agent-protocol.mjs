#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const read = (file) => fs.readFileSync(path.resolve(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.resolve(root, file));

const requiredFiles = [
  'AGENTS.md',
  'docs/AGENT-COLLABORATION-PROTOCOL.md',
  'scripts/ci/agent-session.mjs',
];
for (const file of requiredFiles) if (!exists(file)) failures.push(`MISSING_PROTOCOL_FILE=${file}`);

if (exists('AGENTS.md')) {
  const text = read('AGENTS.md');
  for (const marker of ['READ-BEFORE-ACTION', 'AGENT LOGIN', 'EXACT-SHA RULE', 'ZERO-FALSE-GREEN', 'HANDOFF']) {
    if (!text.includes(marker)) failures.push(`AGENTS_MISSING=${marker}`);
  }
  if (!text.includes('diagnostics/agents/sessions/<session-id>.json')) failures.push('AGENTS_MISSING=session path');
}

if (exists('docs/AGENT-COLLABORATION-PROTOCOL.md')) {
  const text = read('docs/AGENT-COLLABORATION-PROTOCOL.md');
  for (const marker of ['Entry Gate', 'Agent Login', 'Ownership and Locking', 'Action Ledger', 'Handoff Contract', 'Exact-SHA and Stale-State Protection', 'Multi-Agent Conflict Protocol', 'Final Agent Logout']) {
    if (!text.includes(marker)) failures.push(`PROTOCOL_MISSING=${marker}`);
  }
}

if (exists('scripts/ci/agent-session.mjs')) {
  const text = read('scripts/ci/agent-session.mjs');
  for (const marker of ['login', 'logout', 'RUNNING', 'VERIFIED', 'BLOCKED', 'entrySha', 'exitSha']) {
    if (!text.includes(marker)) failures.push(`SESSION_TOOL_MISSING=${marker}`);
  }
}

const result = {
  schemaVersion: 1,
  authority: 'CI_PROTOCOL_GUARD',
  status: failures.length ? 'FAIL' : 'PASS',
  entryGate: 'AGENTS.md',
  protocol: 'docs/AGENT-COLLABORATION-PROTOCOL.md',
  sessionTool: 'scripts/ci/agent-session.mjs',
  failures,
};
fs.mkdirSync(path.resolve(root, 'diagnostics/agents'), { recursive: true });
fs.writeFileSync(path.resolve(root, 'diagnostics/agents/protocol-validation.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
