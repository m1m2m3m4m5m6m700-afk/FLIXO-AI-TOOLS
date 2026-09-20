#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { ingest, validateMessage, markRead, markConsumed, createMessage, respondToMessage, listPendingResponses, getMessage } from './agent-communication.mjs';

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
  const revived = ingest({ ...base, messageId: staleId, idempotencyKey: staleId }, sha);
  assert.equal(revived.status, 'RECEIVED');
  const request = createMessage({
    messageId: 'COOP-REQUEST-001', actor: 'assistantController', recipient: 'executionAgent', intent: 'REQUEST_BOUNDED_EXECUTION', taskId: 'AGENT-WORK-001',
    scope: ['scripts/ci/agent-session.mjs'], entrySha: sha, risk: 'MEDIUM', dependencies: ['coordination'], expectedEvidence: ['accepted-response'],
    stopConditions: ['scope-conflict'], proofObligations: ['response-correlation'], messageType: 'REQUEST', requiresResponse: true
  }, sha);
  const requestRecord = ingest(request, sha);
  assert.equal(requestRecord.messageType, 'REQUEST');
  assert.equal(requestRecord.responseState, 'PENDING');
  assert.equal(listPendingResponses('executionAgent').length, 1);
  assert.throws(() => respondToMessage({ requestId: 'COOP-REQUEST-001', actor: 'executionAgent', responseStatus: 'ACCEPTED' }, sha), /REQUIRES_READ/);
  markRead('COOP-REQUEST-001', 'executionAgent', sha);
  const response = respondToMessage({ requestId: 'COOP-REQUEST-001', actor: 'executionAgent', responseStatus: 'ACCEPTED', payload: { accepted: true } }, sha);
  assert.equal(response.response.messageType, 'RESPONSE');
  assert.equal(response.response.inReplyTo, 'COOP-REQUEST-001');
  assert.equal(response.response.correlationId, 'COOP-REQUEST-001');
  assert.equal(getMessage('COOP-REQUEST-001').responseStatus, 'ACCEPTED');
  assert.equal(listPendingResponses('executionAgent').length, 0);
  console.log('COOP_REQUEST_RESPONSE=PASS');

  const challenge = createMessage({
    messageId: 'COOP-CHALLENGE-001', actor: 'reviewAgent', recipient: 'executionAgent', intent: 'CHALLENGE_SCOPE', taskId: 'AGENT-WORK-001',
    scope: ['scripts/ci/agent-session.mjs'], entrySha: sha, risk: 'MEDIUM', dependencies: ['coordination'], expectedEvidence: ['challenge-response'],
    stopConditions: ['unresolved-challenge'], proofObligations: ['challenge-correlation'], messageType: 'CHALLENGE', requiresResponse: true
  }, sha);
  ingest(challenge, sha);
  markRead('COOP-CHALLENGE-001', 'executionAgent', sha);
  assert.equal(getMessage('COOP-CHALLENGE-001').messageType, 'CHALLENGE');
  assert.throws(() => respondToMessage({ requestId: 'COOP-CHALLENGE-001', actor: 'executionAgent', responseStatus: 'NEEDS_CLARIFICATION' }, '0'.repeat(40)), /RESPONSE_SHA_STALE/);
  console.log('COOP_CHALLENGE=PASS');

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
  for (const cooperationId of ['COOP-REQUEST-001', 'COOP-CHALLENGE-001', 'RESPONSE-' + (await import('node:crypto')).createHash('sha256').update('COOP-REQUEST-001|executionAgent|ACCEPTED|' + sha, 'utf8').digest('hex').slice(0, 48)]) {
    const cooperationKey = (await import('node:crypto')).createHash('sha256').update(cooperationId, 'utf8').digest('hex');
    fs.rmSync(path.join(inbox, cooperationKey + '.json'), { force: true });
  }
  if (originalIndex === null) fs.rmSync(indexFile, { force: true });
  else fs.writeFileSync(indexFile, originalIndex);
  if (fs.existsSync(inbox) && fs.readdirSync(inbox).length === 0) fs.rmSync(inbox, { recursive: true, force: true });
}
