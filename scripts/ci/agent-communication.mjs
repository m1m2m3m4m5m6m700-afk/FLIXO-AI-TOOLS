#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const INBOX_DIR = path.resolve(ROOT, 'diagnostics/agents/inbox');
const INDEX_FILE = path.join(INBOX_DIR, 'index.json');
const CELL_REGISTRY_FILE = path.resolve(ROOT, 'docs/agents/CELL-BOT-REGISTRY.json');
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
const roles = new Set(['assistantController','verification','analysis','codeScout','executionAgent','reviewAgent','testAgent','securityAgent','performanceAgent','certificationAuthority','taskAgent','errorAgent','repairAgent','diagnosticAgent','ACTION-REPAIR','ACTION-REPAIR-2','ACTION-HISTORIAN-3','ALL_AGENTS']);
const recipientKnown = (recipient) => roles.has(recipient) || loadCellBotIds().has(recipient);
const loadCellBotIds = () => {
  if (!fs.existsSync(CELL_REGISTRY_FILE)) return new Set();
  const registry = readJson(CELL_REGISTRY_FILE, { bots: [] });
  return new Set(Array.isArray(registry.bots) ? registry.bots.map((bot) => String(bot.id)) : []);
};
const assertActorKnown = (actor) => {
  if (/^CELL-\\d{3}$/u.test(actor) && !loadCellBotIds().has(actor)) throw new Error('AGENT_MESSAGE_UNKNOWN_CELL_BOT=' + actor);
};
const required = ['messageId','actor','recipient','intent','taskId','scope','entrySha','risk','dependencies','expectedEvidence','stopConditions','proofObligations','createdAt'];
const COUNCIL_RECIPIENTS = new Set(['assistantController','verification','analysis']);
const PRIORITIES = new Set(['P0','P1','P2','P3']);
export const COUNCIL_PRIORITY = 'P0';
export const COUNCIL_RESPONSE_MODE = 'IMMEDIATE';
const isAdministrativeInstruction = (message) => Boolean(
  message?.administrativeInstruction === true ||
  message?.councilOperation === true ||
  String(message?.intent ?? '').startsWith('ADMIN_') ||
  String(message?.intent ?? '').startsWith('COUNCIL_') ||
  Boolean(message?.payload && typeof message.payload === 'object' && message.payload.administrativeInstruction === true)
);
const defaultAdministrativeRecipients = () => [
  'assistantController','verification','analysis','codeScout','executionAgent','reviewAgent',
  'testAgent','securityAgent','performanceAgent','certificationAuthority','taskAgent',
  'errorAgent','repairAgent','diagnosticAgent','ACTION-REPAIR','ACTION-REPAIR-2','ACTION-HISTORIAN-3',
  ...loadCellBotIds(),
];
const requiredAdministrativeRecipients = (message) => {
  const configured = message?.payload?.requiredRecipients;
  if (Array.isArray(configured) && configured.length) return [...new Set(configured.map((item) => String(item).trim()).filter((item) => recipientKnown(item)))];
  return String(message?.recipient ?? '') === 'ALL_AGENTS' ? defaultAdministrativeRecipients() : [String(message.recipient)];
};
const isCouncilOperation = (message) => {
  const payload = message?.payload;
  return message?.councilOperation === true || COUNCIL_RECIPIENTS.has(String(message?.recipient ?? '')) || String(message?.intent ?? '').startsWith('COUNCIL_') || Boolean(payload && typeof payload === 'object' && payload.councilOperation === true);
};
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
  assertActorKnown(String(message.actor));
  if (!recipientKnown(String(message.recipient))) throw new Error('AGENT_MESSAGE_RECIPIENT_INVALID');
  if (typeof message.entrySha !== 'string' || !/^[0-9a-f]{40}$/u.test(message.entrySha)) throw new Error('AGENT_MESSAGE_ENTRY_SHA_INVALID');
  for (const field of ['scope','dependencies','expectedEvidence','stopConditions','proofObligations']) asArray(message[field], field);
  if (!['LOW','MEDIUM','HIGH','CRITICAL'].includes(String(message.risk))) throw new Error('AGENT_MESSAGE_RISK_INVALID');
  if (typeof message.intent !== 'string' || !message.intent.trim()) throw new Error('AGENT_MESSAGE_INTENT_INVALID');
  const councilOperation = isCouncilOperation(message);
  const priority = String(message.priority ?? (councilOperation ? COUNCIL_PRIORITY : 'P1')).toUpperCase();
  if (!PRIORITIES.has(priority)) throw new Error('AGENT_MESSAGE_PRIORITY_INVALID');
  if (councilOperation && priority !== COUNCIL_PRIORITY) throw new Error('AGENT_MESSAGE_COUNCIL_PRIORITY_REQUIRED');
  return Object.freeze({
    schemaVersion: Number(message.schemaVersion ?? 1),
    messageId: String(message.messageId),
    idempotencyKey: String(message.idempotencyKey ?? message.messageId),
    actor: String(message.actor),
    recipient: String(message.recipient),
    intent: String(message.intent),
    priority,
    councilOperation,
    councilResponseMode: councilOperation ? COUNCIL_RESPONSE_MODE : 'NORMAL',
    immediateResponseRequired: councilOperation,
    administrativeInstruction: isAdministrativeInstruction(message),
    requiredAdministrativeRecipients: isAdministrativeInstruction(message) ? requiredAdministrativeRecipients(message) : [],
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
    ...(normalized.administrativeInstruction ? {
      administrativeAcknowledgement: {
        state: 'PENDING_ACK',
        requiredRecipients: [...normalized.requiredAdministrativeRecipients],
        acknowledgements: {},
        attendanceDeadlineAt: String(
          normalized.payload?.attendanceDeadlineAt ??
          new Date(Date.parse(normalized.createdAt) + (Number(normalized.payload?.attendanceWindowSeconds ?? 60) * 1000)).toISOString()
        ),
        attendanceInquiries: {},
      },
    } : {}),
  };
  writeJson(messagePath(normalized.messageId), record);
  index.messages[normalized.messageId] = {
    messageId: normalized.messageId,
    idempotencyKey: normalized.idempotencyKey,
    status,
    recipient: normalized.recipient,
    taskId: normalized.taskId,
    entrySha: normalized.entrySha,
    receivedAt: record.receivedAt,
    updatedAt: record.receivedAt,
  };
  saveIndex(index);
  return record;
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
export function acknowledgeAdministrativeInstruction(messageId, agentId, observedSha = currentSha(), understood = false, accepted = false, understandingSummary = '', commitment = '') {
  ensure();
  const record = loadMessage(messageId);
  if (!record.administrativeInstruction) throw new Error('AGENT_ADMIN_ACK_NOT_REQUIRED');
  if (record.entrySha !== observedSha) throw new Error('AGENT_ADMIN_ACK_SHA_MISMATCH');
  if (!(record.recipient === 'ALL_AGENTS' || record.recipient === agentId)) throw new Error('AGENT_MESSAGE_RECIPIENT_MISMATCH');
  if (!['READ','CONSUMED'].includes(record.status)) throw new Error(`AGENT_ADMIN_ACK_REQUIRES_READ=${record.status}`);
  if (!recipientKnown(agentId)) throw new Error('AGENT_ADMIN_ACK_AGENT_INVALID');
  if (understood !== true) throw new Error('AGENT_ADMIN_ACK_UNDERSTANDING_REQUIRED');
  if (accepted !== true) throw new Error('AGENT_ADMIN_ACK_ACCEPTANCE_REQUIRED');
  if (!String(understandingSummary).trim()) throw new Error('AGENT_ADMIN_ACK_SUMMARY_REQUIRED');
  const adminState = record.administrativeAcknowledgement ?? {
    state: 'PENDING_ACK',
    requiredRecipients: requiredAdministrativeRecipients(record),
    acknowledgements: {},
    attendanceDeadlineAt: new Date(Date.now() + 60000).toISOString(),
    attendanceInquiries: {},
  };
  const msgFingerprint = hash(JSON.stringify({
    messageId: record.messageId,
    intent: record.intent,
    taskId: record.taskId,
    scope: record.scope,
    entrySha: record.entrySha,
    payload: record.payload,
  }));
  adminState.acknowledgements = adminState.acknowledgements ?? {};
  adminState.acknowledgements[agentId] = {
    received: true,
    read: true,
    understood: true,
    accepted: true,
    understandingSummary: String(understandingSummary).trim(),
    commitment: String(commitment).trim(),
    acknowledgedBy: agentId,
    acknowledgedAt: now(),
    acknowledgementSha: observedSha,
    messageFingerprint: msgFingerprint,
  };
  const complete = adminState.requiredRecipients.length > 0 && adminState.requiredRecipients.every((recipient) => {
    const ack = adminState.acknowledgements[recipient];
    return ack?.received === true && ack?.read === true && ack?.understood === true && ack?.accepted === true && ack?.acknowledgementSha === observedSha;
  });
  adminState.state = complete ? 'FULLY_ACKNOWLEDGED' : 'PARTIALLY_ACKNOWLEDGED';
  record.administrativeAcknowledgement = adminState;
  writeJson(messagePath(messageId), record);
  const index = loadIndex();
  index.messages[messageId] = {
    ...(index.messages[messageId] ?? {}),
    administrativeStatus: adminState.state,
    acknowledgedRecipients: Object.keys(adminState.acknowledgements).length,
    requiredRecipients: adminState.requiredRecipients.length,
    updatedAt: now(),
  };
  saveIndex(index);
  return record;
}
export function auditAdministrativeAttendance(messageId, observedSha = currentSha(), nowMs = Date.now()) {
  ensure();
  const record = loadMessage(messageId);
  if (!record.administrativeInstruction) throw new Error('AGENT_ADMIN_ATTENDANCE_NOT_REQUIRED');
  if (record.intent === 'ADMIN_ATTENDANCE_INQUIRY') return { status: 'INQUIRY_WAITING_RESPONSE', messageId, recipient: record.recipient, entrySha: record.entrySha };
  if (record.entrySha !== observedSha) throw new Error('AGENT_ADMIN_ATTENDANCE_SHA_MISMATCH');
  const state = record.administrativeAcknowledgement ?? {
    state: 'PENDING_ACK',
    requiredRecipients: requiredAdministrativeRecipients(record),
    acknowledgements: {},
    attendanceDeadlineAt: new Date(nowMs + 60000).toISOString(),
    attendanceInquiries: {},
  };
  const deadlineMs = Date.parse(state.attendanceDeadlineAt);
  if (!Number.isFinite(deadlineMs)) throw new Error('AGENT_ADMIN_ATTENDANCE_DEADLINE_INVALID');
  if (nowMs < deadlineMs) return { status: 'ATTENDANCE_WINDOW_OPEN', messageId, deadlineAt: state.attendanceDeadlineAt };
  state.attendanceInquiries = state.attendanceInquiries ?? {};
  const missing = state.requiredRecipients.filter((recipient) => !state.acknowledgements?.[recipient]?.accepted);
  for (const recipient of missing) {
    if (state.attendanceInquiries[recipient]) continue;
    const inquiryId = `admin-attendance-inquiry:${messageId}:${recipient}:${observedSha}`;
    const inquiry = {
      schemaVersion: 1,
      messageId: inquiryId,
      idempotencyKey: inquiryId,
      actor: 'assistantController',
      recipient,
      intent: 'ADMIN_ATTENDANCE_INQUIRY',
      priority: 'P0',
      councilOperation: true,
      administrativeInstruction: true,
      taskId: record.taskId,
      scope: ['ADMIN_ATTENDANCE'],
      entrySha: observedSha,
      risk: 'HIGH',
      dependencies: ['MASTER_INBOX','P0_ADMIN_SUMMON'],
      expectedEvidence: ['ATTENDANCE_REASON','UNDERSTOOD','ACCEPTED'],
      stopConditions: ['RESPONSE_RECEIVED','STALE_SHA'],
      proofObligations: ['EXACT_SHA_REVALIDATION'],
      createdAt: now(),
      source: 'MASTER_1_ATTENDANCE_AUDITOR',
      payload: {
        administrativeInstruction: true,
        parentMessageId: messageId,
        attendanceState: 'MISSED_P0_ATTENDANCE',
        question: 'لماذا لم يتم الحضور/الإقرار برسالة الإدارة P0 ضمن نافذة الحضور؟',
        requiredResponse: 'اذكر سبب التخلف، أكد استلام التعليمات، وفهمها واعتمادها على Exact-SHA الحالي.',
        requiredRecipients: [recipient],
        attendanceWindowSeconds: 0,
      },
    };
    const receipt = ingest(inquiry, observedSha);
    state.attendanceInquiries[recipient] = {
      inquiryId,
      state: 'INQUIRY_SENT',
      sentAt: now(),
      messageStatus: receipt.status,
      missedAtSha: observedSha,
    };
  }
  state.state = missing.length ? 'INQUIRY_REQUIRED' : 'FULLY_ACKNOWLEDGED';
  record.administrativeAcknowledgement = state;
  writeJson(messagePath(messageId), record);
  const index = loadIndex();
  index.messages[messageId] = {
    ...(index.messages[messageId] ?? {}),
    administrativeStatus: state.state,
    attendanceMissing: missing.length,
    updatedAt: now(),
  };
  saveIndex(index);
  return { status: state.state, messageId, missingRecipients: missing, inquiries: state.attendanceInquiries };
}
export function markConsumed(messageId, agentId, observedSha = currentSha(), executionAdmitted = false) {
  ensure();
  const record = loadMessage(messageId);
  if (record.entrySha !== observedSha) throw new Error('AGENT_MESSAGE_CONSUME_SHA_MISMATCH');
  if (!(record.recipient === 'ALL_AGENTS' || record.recipient === agentId)) throw new Error('AGENT_MESSAGE_RECIPIENT_MISMATCH');
  if (record.status === 'CONSUMED') return { ...record, duplicate: true };
  if (record.status !== 'READ') throw new Error(`AGENT_MESSAGE_CONSUME_REQUIRES_READ=${record.status}`);
  if (record.administrativeInstruction) {
    const state = record.administrativeAcknowledgement;
    if (state?.state !== 'FULLY_ACKNOWLEDGED') throw new Error('AGENT_ADMIN_ACK_ALL_REQUIRED');
    if (!state?.acknowledgements?.[agentId]?.accepted) throw new Error('AGENT_ADMIN_ACK_REQUIRED');
  }
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
if (!['validate','ingest','read','ack','audit-attendance','presence','send-master','send-supervisor'].includes(command)) throw new Error('Usage: agent-communication.mjs validate|ingest|read|ack|audit-attendance|presence|send-master|send-supervisor');
try {
  if (command === 'send-supervisor') {
    const actor = arg('agent');
    const taskId = arg('task');
    const runId = arg('run-id');
    const fingerprint = arg('fingerprint');
    const attempt = Number(arg('attempt', '21'));
    const exactSha = arg('sha', currentSha());
    const reason = arg('reason', '20_FAILED_REPAIR_ATTEMPTS');
    const messageId = arg('message-id') || 'action-supervisor:' + taskId + ':' + fingerprint + ':' + runId;
    if (!['ACTION-REPAIR','ACTION-REPAIR-2','ACTION-HISTORIAN-3'].includes(actor)) throw new Error('ACTION_SUPERVISOR_ACTOR_INVALID');
    if (!taskId) throw new Error('ACTION_SUPERVISOR_TASK_REQUIRED');
    if (!runId) throw new Error('ACTION_SUPERVISOR_RUN_REQUIRED');
    if (!fingerprint) throw new Error('ACTION_SUPERVISOR_FINGERPRINT_REQUIRED');
    if (!Number.isInteger(attempt) || attempt < 21) throw new Error('ACTION_SUPERVISOR_THRESHOLD_NOT_REACHED');
    if (!/^[0-9a-f]{40}$/u.test(exactSha)) throw new Error('ACTION_SUPERVISOR_EXACT_SHA_INVALID');
    const message = {
      schemaVersion: 1,
      messageId,
      idempotencyKey: messageId + ':' + exactSha,
      actor,
      recipient: 'assistantController',
      intent: 'ACTION_REPAIR_SUPERVISOR_ESCALATION',
      taskId,
      scope: ['ACTION_VAULT_REPAIR_CONTINUITY'],
      entrySha: exactSha,
      risk: 'HIGH',
      dependencies: ['ACTION_VAULT','CURRENT_EXACT_SHA','REPAIR_ATTEMPT_LEDGER'],
      expectedEvidence: ['FAILED_ATTEMPT_COUNT','EXACT_SHA','FAILURE_FINGERPRINT','CURRENT_REPAIR_OWNER'],
      stopConditions: ['CANONICAL_GREEN'],
      proofObligations: ['EXACT_SHA_REVALIDATION','TASK_REMAINS_OPEN','NO_FALSE_GREEN'],
      createdAt: now(),
      source: 'ACTION_VAULT',
      payload: {
        threshold: 20,
        attemptsCompleted: attempt - 1,
        nextAttempt: attempt,
        reason,
        runId,
        failureFingerprint: fingerprint,
        residentPolicy: 'ACTION-RESIDENCY-POLICY',
        closureRule: 'CANONICAL_GREEN_ONLY',
        requestedAction: 'MASTER_REVIEW_AND_CONTINUATION',
      },
    };
    const receipt = ingest(message, exactSha);
    console.log(JSON.stringify({
      status: 'SUPERVISOR_ESCALATION_INGESTED',
      message: receipt,
      relayMarker: '<!-- FLIXO_AGENT_COUNCIL_WAKE -->',
      relayBody: [
        '<!-- FLIXO_AGENT_COUNCIL_WAKE -->',
        '### ACTION REPAIR SUPERVISOR ESCALATION',
        'ROLE: EXECUTION',
        'WORK PACKAGE: ACTION-REPAIR-CONTINUATION-20',
        'ACTOR: ' + actor,
        'TASK ID: ' + taskId,
        'ENTRY SHA: ' + exactSha,
        'RUN ID: ' + runId,
        'FAILURE FINGERPRINT: ' + fingerprint,
        'ATTEMPTS COMPLETED: ' + String(attempt - 1),
        'NEXT ATTEMPT: ' + String(attempt),
        'STATUS: OPEN_CONTINUE_REPAIR',
        'CLOSURE: CANONICAL_GREEN_ONLY',
        'REQUEST: MASTER REVIEW + CONTINUATION',
        'MESSAGE ID: ' + messageId,
      ].join('\\n'),
    }, null, 2));
  } else if (command === 'send-master') {    const actor = arg('agent');
    const taskId = arg('task');
    const intent = arg('intent', 'CELL_DIRECT_MASTER_REQUEST');
    const messageId = arg('message-id') || `cell-master:${actor}:${taskId}:${Date.now().toString(36)}`;
    const idempotencyKey = arg('idempotency-key') || `${messageId}:${arg('sha', currentSha())}`;
    const risk = arg('risk', 'MEDIUM').toUpperCase();
    const exactSha = arg('sha', currentSha());
    const payloadText = arg('payload', '{}');
    if (!/^CELL-\\d{3}$/u.test(actor)) throw new Error('CELL_DIRECT_MASTER_AGENT_INVALID');
    assertActorKnown(actor);
    if (!taskId) throw new Error('CELL_DIRECT_MASTER_TASK_REQUIRED');
    if (!['LOW','MEDIUM','HIGH','CRITICAL'].includes(risk)) throw new Error('CELL_DIRECT_MASTER_RISK_INVALID');
    if (!/^[0-9a-f]{40}$/u.test(exactSha)) throw new Error('CELL_DIRECT_MASTER_EXACT_SHA_INVALID');
    let payload;
    try { payload = JSON.parse(payloadText); } catch { throw new Error('CELL_DIRECT_MASTER_PAYLOAD_INVALID'); }
    const message = {
      schemaVersion: 1,
      messageId,
      idempotencyKey,
      actor,
      recipient: 'assistantController',
      intent,
      taskId,
      scope: ['CELL_DIRECT_MASTER_CHANNEL'],
      entrySha: exactSha,
      risk,
      dependencies: ['MASTER_INBOX','CURRENT_EXACT_SHA'],
      expectedEvidence: ['MASTER_RECEIPT','EXACT_SHA_REVALIDATION'],
      stopConditions: ['MASTER_DECISION','STALE_SHA','CONFLICT'],
      proofObligations: ['MESSAGE_IDEMPOTENCY','EXACT_SHA_REVALIDATION'],
      createdAt: now(),
      source: 'CELL_DIRECT_MASTER',
      payload: { ...payload, directMasterChannel: true, sourceBot: actor },
    };
    console.log(JSON.stringify(ingest(message, currentSha()), null, 2));
  } else if (command === 'presence') {
    const bot = arg('bot');
    const taskId = arg('task');
    const priority = arg('priority', 'P1').toUpperCase();
    const reason = arg('reason');
    const requestedAction = arg('requested-action');
    const evidence = String(args.get('evidence') ?? '').split(',').map((value) => value.trim()).filter(Boolean);
    const blocking = String(args.get('blocking', 'true')).toLowerCase() !== 'false';
    const exactSha = arg('sha', currentSha());
    if (!/^CELL-\\d{3}$/u.test(bot)) throw new Error('AGENT_PRESENCE_BOT_INVALID');
    assertActorKnown(bot);
    if (!['P0','P1','P2','P3'].includes(priority)) throw new Error('AGENT_PRESENCE_PRIORITY_INVALID');
    if (!taskId) throw new Error('AGENT_PRESENCE_TASK_REQUIRED');
    if (!reason) throw new Error('AGENT_PRESENCE_REASON_REQUIRED');
    if (!requestedAction) throw new Error('AGENT_PRESENCE_REQUESTED_ACTION_REQUIRED');
    if (!evidence.length) throw new Error('AGENT_PRESENCE_EVIDENCE_REQUIRED');
    if (!/^[0-9a-f]{40}$/u.test(exactSha)) throw new Error('AGENT_PRESENCE_EXACT_SHA_INVALID');
    const message = {
      schemaVersion: 1,
      messageId: 'presence:' + bot + ':' + taskId + ':' + Date.now().toString(36),
      idempotencyKey: 'presence:' + bot + ':' + taskId + ':' + exactSha,
      actor: bot,
      recipient: 'assistantController',
      intent: 'PRESENCE_REQUEST',
      taskId,
      scope: ['CELL_HQ_PRESENCE'],
      entrySha: exactSha,
      risk: priority === 'P0' ? 'CRITICAL' : priority === 'P1' ? 'HIGH' : priority === 'P2' ? 'MEDIUM' : 'LOW',
      dependencies: ['CELL_HQ'],
      expectedEvidence: evidence,
      stopConditions: ['CONTROLLER_DECISION'],
      proofObligations: ['EXACT_SHA_REVALIDATION'],
      createdAt: now(),
      source: 'CELL_HQ',
      payload: { botId: bot, channel: 'PRESENCE', priority, reason, requestedAction, blocking, evidence },
    };
    console.log(JSON.stringify(ingest(message, currentSha()), null, 2));
  } else if (command === 'validate') {
    const file = arg('message-file');
    if (!file) throw new Error('AGENT_MESSAGE_FILE_REQUIRED');
    const message = JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
    console.log(JSON.stringify(validateMessage(message, currentSha()), null, 2));
  } else if (command === 'ingest') {
    const file = arg('message-file');
    if (!file) throw new Error('AGENT_MESSAGE_FILE_REQUIRED');
    const message = JSON.parse(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
    console.log(JSON.stringify(ingest(message, currentSha()), null, 2));
  } else if (command === 'ack') {
    const id = arg('message-id');
    const agentId = arg('agent');
    const understood = arg('understood') === 'true';
    const accepted = arg('accepted') === 'true';
    const summary = arg('understanding-summary');
    const commitment = arg('commitment');
    console.log(JSON.stringify(acknowledgeAdministrativeInstruction(id, agentId, currentSha(), understood, accepted, summary, commitment), null, 2));
  } else if (command === 'audit-attendance') {
    const id = arg('message-id');
    console.log(JSON.stringify(auditAdministrativeAttendance(id, currentSha()), null, 2));
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
