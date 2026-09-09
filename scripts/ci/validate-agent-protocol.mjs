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
  'docs/AGENT-COORDINATION-CONTROL-PLANE.md',
  'scripts/ci/agent-session.mjs',
  'scripts/ci/agent-coordination.mjs',
  'scripts/validate-ci-contract.mjs',
];
for (const file of requiredFiles) if (!exists(file)) failures.push(`MISSING_PROTOCOL_FILE=${file}`);

const requiredAgentsMarkers = [
  'READ-BEFORE-ACTION', 'AGENT LOGIN', 'OWNERSHIP', 'EXECUTION LEDGER',
  'ROOT-CAUSE-FIRST REPAIR PROTOCOL', 'ROOT-CAUSE ANALYSIS', 'TARGETED REGRESSION',
  'ZERO-FALSE-GREEN', 'COORDINATION CONTROL PLANE', 'HANDOFF / LOGOUT',
  'diagnostics/agents/handoffs/<session-id>.json', 'MANDATORY ENTRY TITLE',
  'trigger → propagation path → violated invariant → responsible source → observable symptom',
  'mechanism proven → causal source repaired → targeted regression passes → affected contract graph passes → fresh exact-SHA evidence proves closure',
];
if (exists('AGENTS.md')) {
  const text = read('AGENTS.md');
  for (const marker of requiredAgentsMarkers) if (!text.includes(marker)) failures.push(`AGENTS_MISSING=${marker}`);
  if (!text.includes('--from-session=<previous-session>')) failures.push('AGENTS_MISSING=continuation-login');
}

const requiredProtocolMarkers = [
  'Mandatory entry contract', 'Agent login', 'Central coordination control plane',
  'Ownership lock', 'Action ledger', 'Mandatory session handoff report', 'Handoff',
  'Evidence and provenance', 'Failure and RCA', 'Conflict protocol',
  'Certification separation', 'Logout', 'Enforcement', '--from-session=<previous-session>',
  'Root-Cause-First Repair Protocol', 'causal defect',
  'trigger → propagation path → violated invariant → responsible source → observable symptom',
  'targeted regression', 'affected dependency/contract graph',
  'mechanism proven → causal source repaired → targeted regression passes → affected contract graph passes → fresh exact-SHA evidence proves closure',
  'symptom-only workaround', 'new deterministic failure',
];
if (exists('docs/AGENT-COLLABORATION-PROTOCOL.md')) {
  const text = read('docs/AGENT-COLLABORATION-PROTOCOL.md');
  for (const marker of requiredProtocolMarkers) if (!text.includes(marker)) failures.push(`PROTOCOL_MISSING=${marker}`);
}

const requiredHandoffMarkers = ['Canonical path', 'Required fields', 'Continuation', 'completedWork', 'failedWork', 'remainingWork', 'executionPlanNext', 'blockers', 'handoffToNextAgent', 'inheritedExitSha'];
if (exists('docs/AGENT-HANDOFF-REPORT-SCHEMA.md')) {
  const text = read('docs/AGENT-HANDOFF-REPORT-SCHEMA.md');
  for (const marker of requiredHandoffMarkers) if (!text.includes(marker)) failures.push(`HANDOFF_SCHEMA_MISSING=${marker}`);
}

const requiredCoordinationMarkers = ['coordination-state.json', 'coordination-locks.json', 'task-packets', 'task-create', 'task-claim', 'task-release', 'task-complete', 'ingest-handoff', 'COORDINATION_CONFLICT'];
if (exists('scripts/ci/agent-coordination.mjs')) {
  const text = read('scripts/ci/agent-coordination.mjs');
  for (const marker of requiredCoordinationMarkers) if (!text.includes(marker)) failures.push(`COORDINATION_TOOL_MISSING=${marker}`);
}

const packageJson = exists('package.json') ? JSON.parse(read('package.json')) : { scripts: {} };
if (typeof packageJson.scripts?.['validate:agent-protocol'] !== 'string') failures.push('PACKAGE_SCRIPT_MISSING=validate:agent-protocol');
if (typeof packageJson.scripts?.['validate:agent-coordination'] !== 'string') failures.push('PACKAGE_SCRIPT_MISSING=validate:agent-coordination');
if (typeof packageJson.scripts?.['agent:coordination'] !== 'string') failures.push('PACKAGE_SCRIPT_MISSING=agent:coordination');

const ciContract = exists('scripts/validate-ci-contract.mjs') ? read('scripts/validate-ci-contract.mjs') : '';
if (ciContract && !/scripts\/ci\/validate-agent-protocol\.mjs/u.test(ciContract)) failures.push('CI_CONTRACT_NOT_WIRED=validate-agent-protocol');
if (ciContract && !/scripts\/ci\/validate-agent-coordination\.mjs/u.test(ciContract)) failures.push('CI_CONTRACT_NOT_WIRED=validate-agent-coordination');

const stateFile = 'diagnostics/agents/coordination-state.json';
const lockFile = 'diagnostics/agents/coordination-locks.json';
if (exists(stateFile)) {
  const state = JSON.parse(read(stateFile));
  if (state.schemaVersion !== 1 || state.authority !== 'AGENT_COORDINATION_CONTROL_PLANE') failures.push('COORDINATION_STATE_INVALID');
  if (!state.tasks || !state.activeSessions) failures.push('COORDINATION_STATE_SHAPE_INVALID');
}
if (exists(lockFile)) {
  const locks = JSON.parse(read(lockFile));
  if (locks.schemaVersion !== 1 || locks.authority !== 'AGENT_SCOPE_LOCKS') failures.push('COORDINATION_LOCKS_INVALID');
  if (!locks.locks) failures.push('COORDINATION_LOCKS_SHAPE_INVALID');
}

const result = {
  schemaVersion: 4,
  authority: 'CI_PROTOCOL_GUARD',
  status: failures.length ? 'FAIL' : 'PASS',
  entryGate: 'AGENTS.md',
  protocol: 'docs/AGENT-COLLABORATION-PROTOCOL.md',
  rootCauseRepairProtocol: 'ROOT-CAUSE-FIRST REPAIR PROTOCOL',
  handoffSchema: 'docs/AGENT-HANDOFF-REPORT-SCHEMA.md',
  coordinationControlPlane: 'scripts/ci/agent-coordination.mjs',
  sessionTool: 'scripts/ci/agent-session.mjs',
  handoffPath: 'diagnostics/agents/handoffs/<sessionId>.json',
  statePath: stateFile,
  lockPath: lockFile,
  enforcement: 'scripts/validate-ci-contract.mjs → protocol + coordination + root-cause-first repair validators',
  failures,
};
fs.mkdirSync(path.resolve(root, 'diagnostics/agents'), { recursive: true });
fs.writeFileSync(path.resolve(root, 'diagnostics/agents/protocol-validation.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
