#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { ingest, validateMessage, markRead, markConsumed } from './agent-communication.mjs';

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
