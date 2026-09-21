#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { validateMessage, MASTER_IDS, MASTER_GROUP } from './agent-communication.mjs';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i];
  if (!token.startsWith('--')) continue;
  const eq = token.indexOf('=');
  const key = token.slice(2, eq >= 0 ? eq : undefined);
  const value = eq >= 0 ? token.slice(eq + 1) : process.argv[i + 1];
  args.set(key, value ?? null);
}
const arg = (name, fallback = '') => String(args.get(name) ?? fallback).trim();
const requireArg = (name) => {
  const value = arg(name);
  if (!value) throw new Error(`MASTER_PEER_${name.toUpperCase()}_REQUIRED`);
  return value;
};
const listArg = (name, fallback) => {
  const value = arg(name, fallback);
  const out = value.split(',').map((item) => item.trim()).filter(Boolean);
  if (!out.length) throw new Error(`MASTER_PEER_${name.toUpperCase()}_REQUIRED`);
  return out;
};
const currentSha = () => execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const repository = process.env.GITHUB_REPOSITORY || requireArg('repo');
const remoteSha = execFileSync('gh', [
  'api',
  `repos/${repository}/git/ref/heads/execution`,
  '--jq',
  '.object.sha',
], { encoding: 'utf8' }).trim();
const command = String(process.argv[2] ?? '').toLowerCase();
if (command !== 'send') {
  throw new Error('Usage: master-peer-communication.mjs send --from=MASTER-3 --to=MASTER-1|MASTER-2|MASTERS --task=... --message=...');
}

const from = requireArg('from');
const to = requireArg('to');
const taskId = requireArg('task');
const messageText = requireArg('message');
const localSha = currentSha();

if (!/^[0-9a-f]{40}$/.test(localSha) || localSha !== remoteSha) {
  throw new Error(`MASTER_PEER_EXACT_SHA_MISMATCH local=${localSha} remote=${remoteSha}`);
}
if (!MASTER_IDS.includes(from)) throw new Error(`MASTER_PEER_UNKNOWN_SENDER=${from}`);
if (!(MASTER_IDS.includes(to) || to === MASTER_GROUP)) throw new Error(`MASTER_PEER_UNKNOWN_RECIPIENT=${to}`);
if (from === to) throw new Error('MASTER_PEER_SELF_ROUTE_FORBIDDEN');

const payloadText = arg('payload');
let extraPayload = {};
if (payloadText) {
  try { extraPayload = JSON.parse(payloadText); } catch { throw new Error('MASTER_PEER_PAYLOAD_INVALID'); }
  if (!extraPayload || typeof extraPayload !== 'object' || Array.isArray(extraPayload)) {
    throw new Error('MASTER_PEER_PAYLOAD_INVALID');
  }
}

const messageId = arg('message-id') || `master-peer:${from}:${to}:${taskId}:${Date.now().toString(36)}`;
const priority = arg('priority', to === MASTER_GROUP ? 'P0' : 'P1').toUpperCase();
const risk = arg('risk', 'MEDIUM').toUpperCase();
const recipientList = to === MASTER_GROUP ? MASTER_IDS.filter((id) => id !== from) : [to];

const message = {
  schemaVersion: 1,
  messageId,
  idempotencyKey: arg('idempotency-key') || `${messageId}:${localSha}`,
  actor: from,
  recipient: to,
  intent: arg('intent', 'MASTER_PEER_MESSAGE'),
  priority,
  councilOperation: to === MASTER_GROUP || priority === 'P0',
  administrativeInstruction: true,
  taskId,
  scope: listArg('scope', 'MASTER_HQ'),
  entrySha: localSha,
  risk,
  dependencies: listArg('dependencies', 'CURRENT_EXACT_SHA,MASTER_INBOX,MASTER_COMMUNICATION_GATE'),
  expectedEvidence: listArg('expected-evidence', 'MASTER_RECEIPT,EXACT_SHA_ACK'),
  stopConditions: listArg('stop-conditions', 'STALE_SHA,CONFLICT,RECIPIENT_UNAVAILABLE'),
  proofObligations: listArg('proof-obligations', 'EXACT_SHA_REVALIDATION,MESSAGE_IDEMPOTENCY,OFFICIAL_ADMIN_CHANNEL'),
  createdAt: new Date().toISOString(),
  source: 'MASTER_PEER_ROUTER',
  payload: {
    ...extraPayload,
    peerMessage: true,
    administrativeInstruction: true,
    automaticDelivery: true,
    conversationId: arg('conversation-id', `master-thread:${taskId}`),
    replyToMessageId: arg('reply-to') || null,
    requiredRecipients: recipientList,
    senderMaster: from,
    recipientMaster: to,
    messageText,
  },
};

const normalized = validateMessage(message, localSha);
const issueNumber = arg('issue', '759');
const body = [
  '<!-- FLIXO_AGENT_MESSAGE -->',
  '<!-- FLIXO_MASTER_PEER_MESSAGE -->',
  '### MASTER PEER MESSAGE',
  '',
  '```json',
  JSON.stringify(message, null, 2),
  '```',
].join('\n');

const receiptJson = execFileSync('gh', [
  'api',
  '--method',
  'POST',
  `repos/${repository}/issues/${issueNumber}/comments`,
  '--raw-field',
  `body=${body}`,
  '--jq',
  '{id:.id,url:.html_url}',
], { encoding: 'utf8' });

console.log(JSON.stringify({
  status: 'MASTER_PEER_MESSAGE_PUBLISHED',
  message: normalized,
  transport: 'canonical-admin-relay',
  issue: Number(issueNumber),
  remoteExecutionSha: remoteSha,
  receipt: JSON.parse(receiptJson),
}, null, 2));
