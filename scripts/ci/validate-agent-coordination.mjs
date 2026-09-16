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
  'scripts/ci/agent-session.mjs': ['login', 'logout', '--from-session=<previous-session>', 'VERIFIED', 'BLOCKED'],
  'docs/AGENT-HANDOFF-REPORT-SCHEMA.md': ['completedWork', 'failedWork', 'remainingWork', 'executionPlanNext', 'handoffToNextAgent'],
  'docs/AGENT-COLLABORATION-PROTOCOL.md': ['Multi-Agent', 'handoff', 'scope', 'RCA', 'Assistant/controller', 'Execution agent', 'Evidence over assertion', 'Stop-and-escalate', 'Challenge-before-mutation', 'Independent review', 'Decision trace'],
  'docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json': ['ASSISTANT_AGENT_COOPERATION_CONTRACT', 'assistantController', 'executionAgent', 'certificationAuthority', 'messageEnvelope', 'no_implicit_authority', 'challenge', 'independent_review', 'decision_trace', 'fresh_state'],
};

for (const [file, markers] of Object.entries(expected)) {
  if (!exists(file)) { failures.push(`MISSING=${file}`); continue; }
  const text = read(file);
  for (const marker of markers) if (!text.includes(marker)) failures.push(`MISSING_MARKER=${file}:${marker}`);
}

if (exists('docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json')) {
  try {
    const contract = JSON.parse(read('docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json'));
    if (contract?.schemaVersion !== 2) failures.push('COOPERATION_SCHEMA_INVALID');
    if (contract?.authority !== 'ASSISTANT_AGENT_COOPERATION_CONTRACT') failures.push('COOPERATION_AUTHORITY_INVALID');
    const rules = ['command', 'truth', 'evidence', 'delegation', 'checkpoint', 'challenge', 'independent_review', 'feedback', 'handoff', 'stop', 'verification', 'learning', 'decision_trace', 'fresh_state', 'no_implicit_authority'];
    for (const key of rules) if (typeof contract?.protocols?.[key] !== 'string' || !contract.protocols[key].trim()) failures.push(`COOPERATION_RULE_MISSING=${key}`);
    for (const key of ['messageId', 'actor', 'intent', 'taskId', 'scope', 'entrySha', 'risk', 'expectedEvidence', 'stopConditions', 'proofObligations']) if (!contract?.messageEnvelope?.required?.includes(key)) failures.push(`COOPERATION_ENVELOPE_MISSING=${key}`);
    for (const key of ['status', 'exitSha', 'changedFiles', 'commands', 'evidenceRefs', 'remainingWork', 'openRcas', 'nextAction', 'decisionTrace', 'verificationState']) if (!contract?.messageEnvelope?.completion?.includes(key)) failures.push(`COOPERATION_COMPLETION_MISSING=${key}`);
    for (const role of ['assistantController', 'executionAgent', 'reviewAgent', 'certificationAuthority']) if (typeof contract?.roles?.[role] !== 'string') failures.push(`COOPERATION_ROLE_MISSING=${role}`);
    for (const tier of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) if (typeof contract?.decisionGates?.[tier] !== 'string') failures.push(`COOPERATION_RISK_GATE_MISSING=${tier}`);
  } catch { failures.push('COOPERATION_JSON_INVALID'); }
}

const packageJson = exists('package.json') ? JSON.parse(read('package.json')) : { scripts: {} };
if (typeof packageJson.scripts?.['validate:agent-coordination'] !== 'string') failures.push('PACKAGE_SCRIPT_MISSING=validate:agent-coordination');
if (typeof packageJson.scripts?.['agent:coordination'] !== 'string') failures.push('PACKAGE_SCRIPT_MISSING=agent:coordination');

const protocolRegistry = exists('docs/PROTOCOL-REGISTRY.json') ? JSON.parse(read('docs/PROTOCOL-REGISTRY.json')) : null;
if (!protocolRegistry) failures.push('PROTOCOL_REGISTRY_MISSING');
else {
  const p20 = protocolRegistry.protocols?.find((item) => item?.id === 'P20');
  if (!p20?.invariant?.includes('decision provenance')) failures.push('P20_COOPERATION_EXTENSION_MISSING');
  if (!p20?.invariant?.includes('independent verification')) failures.push('P20_INDEPENDENT_REVIEW_MISSING');
}

for (const [file, authority, collection] of [
  ['diagnostics/agents/coordination-state.json', 'AGENT_COORDINATION_CONTROL_PLANE', 'tasks'],
  ['diagnostics/agents/coordination-locks.json', 'AGENT_SCOPE_LOCKS', 'locks'],
]) {
  if (!exists(file)) continue;
  try {
    const value = JSON.parse(read(file));
    if (value?.schemaVersion !== 1) failures.push(`STATE_SCHEMA_INVALID=${file}`);
    if (value?.authority !== authority) failures.push(`STATE_AUTHORITY_INVALID=${file}`);
    if (!value?.[collection] || typeof value[collection] !== 'object' || Array.isArray(value[collection])) failures.push(`STATE_COLLECTION_INVALID=${file}:${collection}`);
  } catch { failures.push(`STATE_JSON_INVALID=${file}`); }
}

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const result = {
  schemaVersion: 3,
  authority: 'AGENT_COORDINATION_GUARD',
  status: failures.length ? 'FAIL' : 'PASS',
  checkedSha: sha,
  controlPlane: 'scripts/ci/agent-coordination.mjs',
  sessionTool: 'scripts/ci/agent-session.mjs',
  cooperationContract: 'docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json',
  protocolRegistry: 'docs/PROTOCOL-REGISTRY.json#P20',
  runtimeStatePolicy: 'generated-and-ignored',
  state: 'diagnostics/agents/coordination-state.json',
  locks: 'diagnostics/agents/coordination-locks.json',
  failures,
};

fs.mkdirSync(path.resolve(root, 'diagnostics/agents'), { recursive: true });
fs.writeFileSync(path.resolve(root, 'diagnostics/agents/coordination-validation.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (failures.length) process.exit(1);
