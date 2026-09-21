#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  MASTER_IDS,
  MASTER_GROUP,
  validateMessage,
} from './agent-communication.mjs';

const sha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();

const base = {
  schemaVersion: 1,
  messageId: 'MASTER-PEER-CONTRACT-TEST',
  idempotencyKey: 'MASTER-PEER-CONTRACT-TEST:' + sha,
  actor: 'MASTER-3',
  recipient: 'MASTER-1',
  intent: 'MASTER_PEER_MESSAGE',
  priority: 'P1',
  taskId: 'MASTER-PEER-CONTRACT-001',
  scope: ['MASTER_HQ'],
  entrySha: sha,
  risk: 'MEDIUM',
  dependencies: ['CURRENT_EXACT_SHA'],
  expectedEvidence: ['MASTER_RECEIPT'],
  stopConditions: ['STALE_SHA'],
  proofObligations: ['EXACT_SHA_REVALIDATION'],
  createdAt: new Date().toISOString(),
  source: 'MASTER_PEER_CONTRACT_TEST',
  administrativeInstruction: true,
  payload: {
    peerMessage: true,
    automaticDelivery: true,
    conversationId: 'master-thread:test',
    requiredRecipients: ['MASTER-1'],
    senderMaster: 'MASTER-3',
    recipientMaster: 'MASTER-1',
    messageText: 'test',
  },
};

assert.deepEqual(MASTER_IDS, ['MASTER-1', 'MASTER-2', 'MASTER-3']);
assert.equal(MASTER_GROUP, 'MASTERS');

const direct = validateMessage(base, sha);
assert.equal(direct.masterPeerMessage, true);
assert.equal(direct.recipient, 'MASTER-1');
assert.equal(direct.masterConversationId, 'master-thread:test');

const group = validateMessage({
  ...base,
  messageId: 'MASTER-PEER-CONTRACT-GROUP',
  idempotencyKey: 'MASTER-PEER-CONTRACT-GROUP:' + sha,
  recipient: MASTER_GROUP,
  priority: 'P0',
  councilOperation: true,
  payload: {
    ...base.payload,
    requiredRecipients: ['MASTER-1', 'MASTER-2'],
    recipientMaster: MASTER_GROUP,
  },
}, sha);
assert.equal(group.masterPeerMessage, true);
assert.deepEqual(group.requiredAdministrativeRecipients, ['MASTER-1', 'MASTER-2']);

assert.throws(
  () => validateMessage({
    ...base,
    actor: 'MASTER-3',
    recipient: 'MASTER-3',
  }, sha),
  /SELF_ROUTE_FORBIDDEN/
);

assert.throws(
  () => validateMessage({
    ...base,
    messageId: 'MASTER-PEER-CONTRACT-NONADMIN',
    idempotencyKey: 'MASTER-PEER-CONTRACT-NONADMIN:' + sha,
    administrativeInstruction: false,
    payload: { peerMessage: true },
  }, sha),
  /MASTER_PEER_ADMIN_CHANNEL_REQUIRED/
);

assert.throws(
  () => validateMessage({
    ...base,
    actor: 'MASTER-99',
  }, sha),
  /UNKNOWN_MASTER/
);

assert.throws(
  () => validateMessage({
    ...base,
    entrySha: '0'.repeat(40),
  }, sha),
  /AGENT_MESSAGE_ENTRY_SHA_INVALID/
);

console.log('MASTER_PEER_IDS=PASS');
console.log('MASTER_PEER_DIRECT_ROUTE=PASS');
console.log('MASTER_PEER_GROUP_ROUTE=PASS');
console.log('MASTER_PEER_SELF_ROUTE_FAIL_CLOSED=PASS');
console.log('MASTER_PEER_ADMIN_CHANNEL_REQUIRED=PASS');
console.log('MASTER_PEER_UNKNOWN_MASTER_FAIL_CLOSED=PASS');
console.log('MASTER_PEER_EXACT_SHA_VALIDATION=PASS');
