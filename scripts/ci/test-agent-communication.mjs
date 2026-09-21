#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { ingest, validateMessage, markRead, markConsumed, COUNCIL_PRIORITY, COUNCIL_RESPONSE_MODE } from './agent-communication.mjs';

const root = process.cwd();
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const id = 'TEST-COMM-' + Date.now();
const base = {
  schemaVersion: 1,
  messageId: id,
  idempotencyKey: id + ':1',
  actor: 'assistantController',
  recipient: 'ALL_AGENTS',
  intent: 'TEST_MESSAGE_DELIVERY',
  taskId: 'AGENT-WORK-001',
  scope: ['scripts/ci/agent-session.mjs'],
  entrySha: sha,
  risk: 'LOW',
  dependencies: ['test'],
  expectedEvidence: ['receipt'],
  stopConditions: ['scope-conflict'],
  proofObligations: ['exact-sha'],
  createdAt: new Date().toISOString(),
  source: 'test',
};
const inbox = path.resolve(root, 'diagnostics/agents/inbox');
const key = (await import('node:crypto')).createHash('sha256').update(id, 'utf8').digest('hex');
const messageFile = path.join(inbox, key + '.json');
const indexFile = path.join(inbox, 'index.json');
const originalIndex = fs.existsSync(indexFile) ? fs.readFileSync(indexFile, 'utf8') : null;

try {
  const directId = 'CELL-DIRECT-MASTER-' + Date.now();
  const direct = JSON.parse(execFileSync('node', [
    'scripts/ci/agent-communication.mjs','send-master',
    '--agent=CELL-001','--task=CELL-MASTER-001',
    '--intent=CELL_DIRECT_MASTER_REQUEST','--risk=MEDIUM',
    '--sha='+sha,'--message-id='+directId,
    '--idempotency-key='+directId+':'+sha,
    '--payload='+JSON.stringify({request:'MASTER_REVIEW'})
  ], { encoding: 'utf8' }));
  assert.equal(direct.status, 'RECEIVED');
  assert.equal(direct.actor, 'CELL-001');
  assert.equal(direct.recipient, 'assistantController');
  assert.equal(direct.payload.directMasterChannel, true);
  assert.equal(direct.entrySha, sha);
  const directPath = path.join(inbox, (await import('node:crypto')).createHash('sha256').update(directId, 'utf8').digest('hex') + '.json');
  fs.rmSync(directPath, { force: true });
  const directIndex = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  delete directIndex.messages[directId];
  fs.writeFileSync(indexFile, JSON.stringify(directIndex, null, 2) + '\n');

const councilTargets = ['assistantController','codeScout','executionAgent','reviewAgent','testAgent','securityAgent','performanceAgent','certificationAuthority','taskAgent','errorAgent','repairAgent','diagnosticAgent','ACTION-REPAIR','ACTION-REPAIR-2','ACTION-HISTORIAN-3','ALL_AGENTS'];
for (const [index, recipient] of councilTargets.entries()) {
  const routed = validateMessage({ ...base, messageId: id + '-COUNCIL-' + index, idempotencyKey: id + '-COUNCIL-' + index, recipient, intent: 'COUNCIL_QUESTION', payload: { councilOperation: true } }, sha);
  assert.equal(routed.priority, COUNCIL_PRIORITY);
  assert.equal(routed.councilOperation, true);
  assert.equal(routed.councilResponseMode, COUNCIL_RESPONSE_MODE);
  assert.equal(routed.immediateResponseRequired, true);
}
const councilMessage = validateMessage({ ...base, messageId: id + '-COUNCIL', idempotencyKey: id + '-COUNCIL', recipient: 'assistantController', intent: 'COUNCIL_QUESTION', payload: { councilOperation: true } }, sha);
assert.equal(councilMessage.priority, COUNCIL_PRIORITY);
assert.equal(councilMessage.councilOperation, true);
assert.throws(() => validateMessage({ ...base, messageId: id + '-COUNCIL-BAD', idempotencyKey: id + '-COUNCIL-BAD', recipient: 'assistantController', intent: 'COUNCIL_QUESTION', priority: 'P1' }, sha), /COUNCIL_PRIORITY_REQUIRED/);
console.log('COUNCIL_MESSAGE_P0_PRIORITY=PASS');
  assert.equal(validateMessage(base, sha).entrySha, sha);
  assert.throws(() => validateMessage({ ...base, recipient: undefined }, sha), /RECIPIENT|REQUIRED_FIELD/);
  const first = ingest(base, sha);
  assert.equal(first.status, 'RECEIVED');
  const duplicate = ingest(base, sha);
  assert.equal(duplicate.duplicate, true);
  const read = markRead(id, 'assistantController', sha);
  assert.equal(read.status, 'READ');
  assert.throws(() => markConsumed(id, 'assistantController', sha, false), /EXECUTION_ADMISSION_REQUIRED/);
  const consumed = markConsumed(id, 'assistantController', sha, true);
  assert.equal(consumed.status, 'CONSUMED');
  const consumedDuplicate = markConsumed(id, 'assistantController', sha, true);
  assert.equal(consumedDuplicate.duplicate, true);
  assert.throws(
    () => ingest({ ...base, idempotencyKey: id + ':2', intent: 'CONFLICTING_INTENT' }, sha),
    /IDEMPOTENCY_COLLISION/
  );

  const staleId = id + '-STALE';
  const stale = ingest({ ...base, messageId: staleId, idempotencyKey: staleId }, '0000000000000000000000000000000000000000');
  assert.equal(stale.status, 'STALE');
  const revived = ingest({ ...base, messageId: staleId, idempotencyKey: staleId }, sha);
  assert.equal(revived.status, 'RECEIVED');
  const staleKey = (await import('node:crypto')).createHash('sha256').update(staleId, 'utf8').digest('hex');
  fs.rmSync(path.join(inbox, staleKey + '.json'), { force: true });
  const index = JSON.parse(fs.readFileSync(indexFile, 'utf8'));
  delete index.messages[staleId];
  fs.writeFileSync(indexFile, JSON.stringify(index, null, 2) + '\n');

  console.log('AGENT_COMMUNICATION_TEST=PASS');
  console.log('MESSAGE_IDEMPOTENCY=PASS');
  console.log('STALE_MESSAGE_FAIL_CLOSED=PASS');
} finally {
  fs.rmSync(messageFile, { force: true });
  if (originalIndex === null) fs.rmSync(indexFile, { force: true });
  else fs.writeFileSync(indexFile, originalIndex);
  if (fs.existsSync(inbox) && fs.readdirSync(inbox).length === 0) fs.rmSync(inbox, { recursive: true, force: true });
}
