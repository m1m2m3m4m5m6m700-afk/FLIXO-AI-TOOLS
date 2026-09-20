#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const INBOX_DIR = path.resolve(ROOT, 'diagnostics/agents/inbox');
const INDEX_FILE = path.join(INBOX_DIR, 'index.json');
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const token = process.argv[i];
  if (!token.startsWith('--')) continue;
  const eq = token.indexOf('=');
  const key = token.slice(2, eq >= 0 ? eq : undefined);
  const value = eq >= 0 ? token.slice(eq + 1) : process.argv[i + 1];
  args.set(key, value ?? null);
}
const command = String(process.argv[2] ?? '').toLowerCase();
const arg = (name, fallback = '') => String(args.get(name) ?? fallback).trim();
const now = () => new Date().toISOString();
const currentSha = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const safeId = (value, label) => {
  if (!value || value.length > 160 || !/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)) throw new Error(`AGENT_MESSAGE_INVALID_${label.toUpperCase()}`);
  return value;
};
const hash = (value) => createHash('sha256').update(value, 'utf8').digest('hex');
const messageKey = (messageId) => hash(messageId);
const messagePath = (messageId) => path.join(INBOX_DIR, `${messageKey(messageId)}.json`);
const readJson = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\\n`);
};
const ensure = () => { fs.mkdirSync(INBOX_DIR, { recursive: true }); };
const roles = new Set(['assistantController','codeScout','executionAgent','reviewAgent','testAgent','securityAgent','performanceAgent','certificationAuthority','taskAgent','errorAgent','repairAgent','diagnosticAgent','ALL_AGENTS']);
const MESSAGE_TYPES = new Set(['DIRECTIVE','REQUEST','RESPONSE','CHALLENGE','HANDOFF']);
const RESPONSE_STATUSES = new Set(['ACCEPTED','REJECTED','ACKNOWLEDGED','BLOCKED','NEEDS_CLARIFICATION']);
const AGENT_ENDPOINT_RE = /^(?:assistantController|codeScout|executionAgent|reviewAgent|testAgent|securityAgent|performanceAgent|certificationAuthority|taskAgent|errorAgent|repairAgent|diagnosticAgent)(?:[-.:][A-Za-z0-9._:-]+)?$/u;
const isAgentEndpoint = (value) => roles.has(value) || AGENT_ENDPOINT_RE.test(value);
const endpointMatchesActor = (recipient, actor) => recipient === 'ALL_AGENTS' || recipient === actor || String(actor).startsWith(String(recipient) + '-');
const required = ['messageId','actor','recipient','intent','taskId','scope','entrySha','risk','dependencies','expectedEvidence','stopConditions','proofObligations','createdAt'];
const asArray = (value, name) => {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== 'string' || !item.trim())) {
    throw new Error(`AGENT_MESSAGE_${name.toUpperCase()}_INVALID`);
  }
  return value.map((item) => item.trim());
};
export function validateMessage(message, observedSha = currentSha()) {
  if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error('AGENT_MESSAGE_ENVELOPE_INVALID');
  for (const field of required) {
    if (message[field] === undefined || message[field] === null || (typeof message[field] === 'string' && !message[field].trim())) {
      throw new Error(`AGENT_MESSAGE_REQUIRED_FIELD_MISSING=${field}`);
    }
  }
  safeId(String(message.messageId), 'message_id');
  safeId(String(message.taskId), 'task_id');
  if (typeof message.actor !== 'string' || !message.actor.trim()) throw new Error('AGENT_MESSAGE_ACTOR_INVALID');
  if (!isAgentEndpoint(String(message.recipient))) throw new Error('AGENT_MESSAGE_RECIPIENT_INVALID');
  if (typeof message.entrySha !== 'string' || !/^[0-9a-f]{40}$/u.test(message.entrySha)) throw new Error('AGENT_MESSAGE_ENTRY_SHA_INVALID');
  for (const field of ['scope','dependencies','expectedEvidence','stopConditions','proofObligations']) asArray(message[field], field);
  if (!['LOW','MEDIUM','HIGH','CRITICAL'].includes(String(message.risk))) throw new Error('AGENT_MESSAGE_RISK_INVALID');
  if (typeof message.intent !== 'string' || !message.intent.trim()) throw new Error('AGENT_MESSAGE_INTENT_INVALID');
  const messageType = String(message.messageType ?? 'DIRECTIVE').toUpperCase();
  if (!MESSAGE_TYPES.has(messageType)) throw new Error('AGENT_MESSAGE_TYPE_INVALID');
  const requiresResponse = message.requiresResponse === undefined ? ['REQUEST', 'CHALLENGE', 'HANDOFF'].includes(messageType) : message.requiresResponse === true;
  if (['REQUEST', 'CHALLENGE', 'HANDOFF'].includes(messageType) && !requiresResponse) throw new Error('AGENT_MESSAGE_RESPONSE_REQUIREMENT_INVALID');
  if (messageType === 'RESPONSE') {
    safeId(String(message.inReplyTo ?? ''), 'in_reply_to');
    safeId(String(message.correlationId ?? ''), 'correlation_id');
    if (!RESPONSE_STATUSES.has(String(message.responseStatus))) throw new Error('AGENT_MESSAGE_RESPONSE_STATUS_INVALID');
  }
  const responseState = String(message.responseState ?? (requiresResponse ? 'PENDING' : 'NONE')).toUpperCase();
  if (!['NONE','PENDING','RESPONDED','BLOCKED'].includes(responseState)) throw new Error('AGENT_MESSAGE_RESPONSE_STATE_INVALID');
  return Object.freeze({
    schemaVersion: Number(message.schemaVersion ?? 1),
    messageId: String(message.messageId),
    idempotencyKey: String(message.idempotencyKey ?? message.messageId),
    actor: String(message.actor),
    recipient: String(message.recipient),
    intent: String(message.intent),
    taskId: String(message.taskId),
    scope: [...message.scope],
    entrySha: String(message.entrySha),
    risk: String(message.risk),
    dependencies: [...message.dependencies],
    expectedEvidence: [...message.expectedEvidence],
    stopConditions: [...message.stopConditions],
    proofObligations: [...message.proofObligations],
    createdAt: String(message.createdAt),
    source: String(message.source ?? 'UNKNOWN'),
    notificationRef: message.notificationRef ?? null,
    payload: message.payload ?? null,
    messageType,
    requiresResponse,
    correlationId: message.correlationId ?? null,
    inReplyTo: message.inReplyTo ?? null,
    responseState,
    responseStatus: message.responseStatus ?? null,
    responseMessageId: message.responseMessageId ?? null,
    respondedBy: message.respondedBy ?? null,
    respondedAt: message.respondedAt ?? null,
    observedSha: observedSha,
  });
}
function loadIndex() {
  return readJson(INDEX_FILE, { schemaVersion: 1, authority: 'AGENT_COMMUNICATION_INBOX', messages: {} });
}
function saveIndex(index) { index.updatedAt = now(); writeJson(INDEX_FILE, index); }
function loadMessage(messageId) {
  const file = messagePath(messageId);
  if (!fs.existsSync(file)) throw new Error(`AGENT_MESSAGE_NOT_FOUND=${messageId}`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}
export function ingest(message, observedSha = currentSha()) {
  ensure();
  const normalized = validateMessage(message, observedSha);
  const index = loadIndex();
  const existing = index.messages[normalized.messageId];
  if (existing) {
    if (existing.idempotencyKey !== normalized.idempotencyKey || existing.entrySha !== normalized.entrySha) {
      throw new Error(`AGENT_MESSAGE_IDEMPOTENCY_COLLISION=${normalized.messageId}`);
    }
    if (existing.status === 'STALE' && normalized.entrySha === observedSha) {
      const revived = { ...loadMessage(normalized.messageId), status: 'RECEIVED', revalidatedAt: now(), revalidatedSha: observedSha, duplicate: true };
      writeJson(messagePath(normalized.messageId), revived);
      index.messages[normalized.messageId] = { ...(index.messages[normalized.messageId] ?? {}), status: 'RECEIVED', updatedAt: now() };
      saveIndex(index);
      return revived;
    }
    return { ...existing, duplicate: true };
  }
  const status = normalized.entrySha === observedSha ? 'RECEIVED' : 'STALE';
  const record = {
    ...normalized,
    idempotencyKey: normalized.idempotencyKey,
    status,
    receivedAt: now(),
    readAt: null,
    consumedAt: null,
    consumedBy: null,
    duplicate: false,
  };
  writeJson(messagePath(normalized.messageId), record);
  index.messages[normalized.messageId] = {
    messageId: normalized.messageId,
    idempotencyKey: normalized.idempotencyKey,
    status,
    recipient: normalized.recipient,
    taskId: normalized.taskId,
    entrySha: normalized.entrySha,
    messageType: normalized.messageType,
    requiresResponse: normalized.requiresResponse,
    correlationId: normalized.correlationId,
    responseState: normalized.responseState,
    responseStatus: normalized.responseStatus,
    responseMessageId: normalized.responseMessageId,
    receivedAt: record.receivedAt,
    updatedAt: record.receivedAt,
  };
  saveIndex(index);
  return record;
}
export function createMessage({ messageId, actor, recipient, intent, taskId, scope, entrySha,
  risk = 'MEDIUM', dependencies = ['coordination'], expectedEvidence = ['message-receipt'],
  stopConditions = ['scope-conflict', 'stale-sha', 'authority-conflict'], proofObligations = ['exact-sha'],
  messageType = 'DIRECTIVE', requiresResponse, correlationId = null, inReplyTo = null, payload = null,
  source = 'agent-coordination', createdAt = now() } = {}, observedSha = currentSha()) {
  const type = String(messageType).toUpperCase();
  const resolvedId = String(messageId ?? type + '-' + hash(String(actor) + '|' + String(recipient) + '|' + String(taskId) + '|' + String(intent) + '|' + String(entrySha)).slice(0, 24));
  return validateMessage({ schemaVersion: 2, messageId: resolvedId, idempotencyKey: resolvedId, actor, recipient, intent, taskId, scope,
    entrySha, risk, dependencies, expectedEvidence, stopConditions, proofObligations, createdAt, source, payload, messageType: type,
    requiresResponse: requiresResponse ?? ['REQUEST', 'CHALLENGE', 'HANDOFF'].includes(type), correlationId, inReplyTo }, observedSha);
}

export function sendMessage(message, observedSha = currentSha()) { return ingest(message, observedSha); }

export function respondToMessage({ requestId, actor, responseStatus = 'ACKNOWLEDGED', intent, payload = null, evidence = ['response-receipt'] } = {}, observedSha = currentSha()) {
  const original = loadMessage(requestId);
  const originalType = String(original.messageType ?? 'DIRECTIVE');
  if (!['REQUEST','CHALLENGE','HANDOFF'].includes(originalType)) throw new Error('AGENT_MESSAGE_RESPONSE_TARGET_INVALID');
  if (original.entrySha !== observedSha) throw new Error('AGENT_MESSAGE_RESPONSE_SHA_STALE');
  if (original.status === 'STALE') throw new Error('AGENT_MESSAGE_RESPONSE_STALE');
  if (!['READ','CONSUMED'].includes(original.status)) throw new Error('AGENT_MESSAGE_RESPONSE_REQUIRES_READ');
  if (original.requiresResponse !== true) throw new Error('AGENT_MESSAGE_RESPONSE_NOT_REQUIRED');
  if (original.responseState === 'RESPONDED') return { request: original, duplicate: true };
  if (!endpointMatchesActor(String(original.recipient), String(actor))) throw new Error('AGENT_MESSAGE_RESPONSE_ACTOR_MISMATCH');
  if (!RESPONSE_STATUSES.has(String(responseStatus))) throw new Error('AGENT_MESSAGE_RESPONSE_STATUS_INVALID');
  const responseId = 'RESPONSE-' + hash(String(requestId) + '|' + String(actor) + '|' + String(responseStatus) + '|' + String(observedSha)).slice(0, 48);
  const response = createMessage({ messageId: responseId, actor, recipient: original.actor, intent: intent ?? 'RESPONSE_TO_' + requestId, taskId: original.taskId,
    scope: original.scope, entrySha: observedSha, risk: original.risk, dependencies: original.dependencies, expectedEvidence: evidence,
    stopConditions: original.stopConditions, proofObligations: original.proofObligations, messageType: 'RESPONSE', requiresResponse: false,
    correlationId: original.correlationId ?? original.messageId, inReplyTo: original.messageId, payload: { responseStatus, data: payload }, source: 'agent-coordination' }, observedSha);
  const storedResponse = ingest(response, observedSha);
  const updated = { ...original, responseState: 'RESPONDED', responseStatus: String(responseStatus), responseMessageId: storedResponse.messageId, respondedBy: actor, respondedAt: now() };
  writeJson(messagePath(requestId), updated);
  const index = loadIndex();
  index.messages[requestId] = { ...(index.messages[requestId] ?? {}), status: updated.status, responseState: updated.responseState, responseStatus: updated.responseStatus, responseMessageId: updated.responseMessageId, respondedBy: updated.respondedBy, respondedAt: updated.respondedAt, updatedAt: now() };
  saveIndex(index);
  return { request: updated, response: storedResponse, duplicate: false };
}

export function listPendingResponses(agentId) {
  ensure(); const index = loadIndex();
  return Object.values(index.messages ?? {}).filter((item) => item.recipient === agentId && item.requiresResponse === true && item.responseState === 'PENDING').map((item) => loadMessage(item.messageId));
}
export function getMessage(messageId) { ensure(); return loadMessage(messageId); }
export function markRead(messageId, agentId, observedSha = currentSha()) {
  ensure();
  const record = loadMessage(messageId);
  if (record.status === 'STALE' || record.entrySha !== observedSha) throw new Error('AGENT_MESSAGE_STALE_REQUIRES_REVALIDATION');
  if (!(record.recipient === 'ALL_AGENTS' || record.recipient === agentId)) throw new Error('AGENT_MESSAGE_RECIPIENT_MISMATCH');
  if (!['RECEIVED','READ'].includes(record.status)) throw new Error(`AGENT_MESSAGE_NOT_READABLE=${record.status}`);
  record.status = 'READ';
  record.readAt = record.readAt ?? now();
  record.readBy = agentId;
  writeJson(messagePath(messageId), record);
  const index = loadIndex();
  index.messages[messageId] = { ...(index.messages[messageId] ?? {}), status: 'READ', updatedAt: now() };
  saveIndex(index);
  return record;
}
export function markConsumed(messageId, agentId, observedSha = currentSha(), executionAdmitted = false) {
  ensure();
  const record = loadMessage(messageId);
  if (record.entrySha !== observedSha) throw new Error('AGENT_MESSAGE_CONSUME_SHA_MISMATCH');
  if (!(record.recipient === 'ALL_AGENTS' || record.recipient === agentId)) throw new Error('AGENT_MESSAGE_RECIPIENT_MISMATCH');
  if (record.status === 'CONSUMED') return { ...record, duplicate: true };
  if (record.status !== 'READ') throw new Error(`AGENT_MESSAGE_CONSUME_REQUIRES_READ=${record.status}`);
  if (executionAdmitted !== true) throw new Error('AGENT_MESSAGE_EXECUTION_ADMISSION_REQUIRED');
  record.status = 'CONSUMED';
  record.consumedAt = now();
  record.consumedBy = agentId;
  writeJson(messagePath(messageId), record);
  const index = loadIndex();
  index.messages[messageId] = { ...(index.messages[messageId] ?? {}), status: 'CONSUMED', updatedAt: now() };
  saveIndex(index);
  return record;
}
if (!['validate','ingest','send','respond','pending','read','ack'].includes(command)) throw new Error('Usage: agent-communication.mjs validate|ingest|send|respond|pending|read|ack');
try {
  if (command === 'validate') {
    const file = arg('message-file');
    if (!file) throw new Error('AGENT_MESSAGE_FILE_REQUIRED');
    const message = JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
    console.log(JSON.stringify(validateMessage(message, currentSha()), null, 2));
  } else if (command === 'ingest' || command === 'send') {
    const file = arg('message-file');
    if (!file) throw new Error('AGENT_MESSAGE_FILE_REQUIRED');
    const message = JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
    console.log(JSON.stringify(sendMessage(message, currentSha()), null, 2));
  } else if (command === 'respond') {
    console.log(JSON.stringify(respondToMessage({ requestId: arg('reply-to'), actor: arg('agent'), responseStatus: arg('response-status', 'ACKNOWLEDGED').toUpperCase(), intent: arg('intent', ''), payload: arg('payload', '') || null }, currentSha()), null, 2));
  } else if (command === 'pending') {
    console.log(JSON.stringify(listPendingResponses(arg('agent')), null, 2));
  } else if (command === 'read') {
    const id = arg('message-id');
    const agentId = arg('agent');
    console.log(JSON.stringify(markRead(id, agentId, currentSha()), null, 2));
  } else {
    const id = arg('message-id');
    const agentId = arg('agent');
    const admitted = arg('execution-admitted') === 'true';
    console.log(JSON.stringify(markConsumed(id, agentId, currentSha(), admitted), null, 2));
  }
} catch (error) {
  console.error('AGENT_MESSAGE_GATE_BLOCK=' + String(error?.message ?? error));
  process.exit(1);
}
