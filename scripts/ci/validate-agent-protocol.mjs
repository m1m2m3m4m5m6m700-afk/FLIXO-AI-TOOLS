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
  'docs/AGENT-HANDOFF-REPORT-SCHEMA.md',
  'scripts/ci/agent-session.mjs',
  'scripts/validate-ci-contract.mjs',
];
for (const file of requiredFiles) if (!exists(file)) failures.push(`MISSING_PROTOCOL_FILE=${file}`);

const requiredAgentsMarkers = [
  'READ-BEFORE-ACTION',
  'AGENT LOGIN',
  'OWNERSHIP',
  'EXECUTION LEDGER',
  'ZERO-FALSE-GREEN',
  'SESSION HANDOFF REPORT',
  'HANDOFF / LOGOUT',
  'MANDATORY ENTRY TITLE',
];
if (exists('AGENTS.md')) {
  const text = read('AGENTS.md');
  for (const marker of requiredAgentsMarkers) if (!text.includes(marker)) failures.push(`AGENTS_MISSING=${marker}`);
  if (!text.includes('diagnostics/agents/sessions/<session-id>.json')) failures.push('AGENTS_MISSING=session-path');
  if (!text.includes('diagnostics/agents/handoffs/<session-id>.json')) failures.push('AGENTS_MISSING=handoff-path');
  if (!text.includes('--from-session=<previous-session>')) failures.push('AGENTS_MISSING=continuation-login');
}

const requiredProtocolMarkers = [
  'Mandatory entry contract',
  'Agent login',
  'Ownership lock',
  'Action ledger',
  'Mandatory session handoff report',
  'Handoff',
  'Evidence and provenance',
  'Failure and RCA',
  'Conflict protocol',
  'Certification separation',
  'Logout',
  'Enforcement',
  '--from-session=<previous-session>',
];
if (exists('docs/AGENT-COLLABORATION-PROTOCOL.md')) {
  const text = read('docs/AGENT-COLLABORATION-PROTOCOL.md');
  for (const marker of requiredProtocolMarkers) if (!text.includes(marker)) failures.push(`PROTOCOL_MISSING=${marker}`);
}

const requiredHandoffMarkers = [
  'Canonical report path',
  'Required report contract',
  'Continuation rule',
  'completedWork',
  'failedWork',
  'remainingWork',
  'executionPlanNext',
  'blockers',
  'handoffToNextAgent',
  'inheritedExitSha',
];
if (exists('docs/AGENT-HANDOFF-REPORT-SCHEMA.md')) {
  const text = read('docs/AGENT-HANDOFF-REPORT-SCHEMA.md');
  for (const marker of requiredHandoffMarkers) if (!text.includes(marker)) failures.push(`HANDOFF_SCHEMA_MISSING=${marker}`);
}

const requiredSessionMarkers = [
  'login', 'logout', 'schemaVersion', 'sessionId', 'agentId', 'entrySha', 'exitSha',
  'RUNNING', 'VERIFIED', 'BLOCKED', 'from-session', 'handoffDir', 'remainingWork',
  'executionPlanNext', 'inheritedExitSha', 'AGENT_SESSION_HANDOFF',
];
if (exists('scripts/ci/agent-session.mjs')) {
  const text = read('scripts/ci/agent-session.mjs');
  for (const marker of requiredSessionMarkers) if (!text.includes(marker)) failures.push(`SESSION_TOOL_MISSING=${marker}`);
}

const packageJson = exists('package.json') ? JSON.parse(read('package.json')) : { scripts: {} };
if (typeof packageJson.scripts?.['validate:agent-protocol'] !== 'string') failures.push('PACKAGE_SCRIPT_MISSING=validate:agent-protocol');

const ciContract = exists('scripts/validate-ci-contract.mjs') ? read('scripts/validate-ci-contract.mjs') : '';
if (ciContract && !/scripts\/ci\/validate-agent-protocol\.mjs/u.test(ciContract)) failures.push('CI_CONTRACT_NOT_WIRED=validate-agent-protocol');

const result = {
  schemaVersion: 2,
  authority: 'CI_PROTOCOL_GUARD',
  status: failures.length ? 'FAIL' : 'PASS',
  entryGate: 'AGENTS.md',
  protocol: 'docs/AGENT-COLLABORATION-PROTOCOL.md',
  handoffSchema: 'docs/AGENT-HANDOFF-REPORT-SCHEMA.md',
  sessionTool: 'scripts/ci/agent-session.mjs',
  handoffPath: 'diagnostics/agents/handoffs/<sessionId>.json',
  enforcement: 'scripts/validate-ci-contract.mjs → validate-agent-protocol.mjs',
  failures,
};
fs.mkdirSync(path.resolve(root, 'diagnostics/agents'), { recursive: true });
fs.writeFileSync(path.resolve(root, 'diagnostics/agents/protocol-validation.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
