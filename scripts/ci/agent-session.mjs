#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { assertAgentAdmission, assertProtocolDefinition } from './repair-protocol.mjs';
import { ingest as ingestAgentMessage, markRead as readAgentMessage, markConsumed as consumeAgentMessage } from './agent-communication.mjs';

const ROOT = process.cwd();
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
const rawSessionId = String(args.get('session') ?? process.env.FLIXO_AGENT_SESSION ?? '').trim();
const rawFromSession = String(args.get('from-session') ?? process.env.FLIXO_AGENT_FROM_SESSION ?? '').trim() || null;
const rawMessageFile = String(args.get('message-file') ?? process.env.FLIXO_AGENT_MESSAGE_FILE ?? '').trim() || null;
const rawMessageId = String(args.get('message-id') ?? process.env.FLIXO_AGENT_MESSAGE_ID ?? '').trim() || null;
const messageExecutionAdmitted = String(args.get('message-execution-admitted') ?? process.env.FLIXO_AGENT_MESSAGE_EXECUTION_ADMITTED ?? 'false').trim() === 'true';
const safeSessionId = (value, label) => {
  if (!value || value.length > 128 || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) throw new Error(`INVALID_${label.toUpperCase()}_ID`);
  return value;
};
const sessionId = safeSessionId(rawSessionId, 'session');
const agentId = String(args.get('agent') ?? process.env.FLIXO_AGENT_ID ?? '').trim();
const role = String(args.get('role') ?? process.env.FLIXO_AGENT_ROLE ?? 'implementation').trim();
const gitBranch = () => execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim();
const protocolAdmission = assertAgentAdmission({ actor: role, branch: gitBranch(), mutation: false });
const rca = String(args.get('rca') ?? process.env.FLIXO_AGENT_RCA ?? '').trim() || null;
const scope = String(args.get('scope') ?? process.env.FLIXO_AGENT_SCOPE ?? '').split(',').map((v) => v.trim()).filter(Boolean);
const fromSession = rawFromSession ? safeSessionId(rawFromSession, 'previous_session') : null;
const taskId = String(args.get('task') ?? process.env.FLIXO_AGENT_TASK ?? '').trim();
const sessionDir = path.resolve(ROOT, 'diagnostics/agents/sessions');
const visibilityDir = path.resolve(ROOT, 'docs/agents/ledger');
const handoffDir = path.resolve(ROOT, 'diagnostics/agents/handoffs');
const now = () => new Date().toISOString();
const gitSha = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const requiredReads = ['AGENTS.md', 'docs/AGENT-COLLABORATION-PROTOCOL.md', 'docs/AGENT-HANDOFF-REPORT-SCHEMA.md', 'docs/MINIMAL-CI-FINAL-ARCHITECTURE.md', 'scripts/ci/test-plan.json', 'scripts/ci/assertion-registry.json'];
const split = (value, separator = ',') => String(value ?? '').split(separator).map((v) => v.trim()).filter(Boolean);
const storageKey = (id) => createHash('sha256').update(id).digest('hex');
const sessionPath = (id) => path.join(sessionDir, `${storageKey(id)}.json`);
const handoffPath = (id) => path.join(handoffDir, `${storageKey(id)}.json`);
const visibilityPath = (id) => path.join(visibilityDir, `${storageKey(id)}.json`);
const roles = new Set(['analysis','implementation','verification','release','assistantController','codeScout','executionAgent','reviewAgent','testAgent','securityAgent','performanceAgent','certificationAuthority','taskAgent','errorAgent','repairAgent','diagnosticAgent']);
const writeVisibility = (record) => {
  fs.mkdirSync(visibilityDir, { recursive: true });
  fs.writeFileSync(visibilityPath(sessionId), `${JSON.stringify(record, null, 2)}\n`);
};
const secretLike = (value) => /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|ghp_[A-Za-z0-9_]+|github_pat_[A-Za-z0-9_]+|Bearer\s+[A-Za-z0-9._-]+|sk-[A-Za-z0-9_-]+)/i.test(String(value ?? ''));
const assertSafeText = (...values) => { for (const value of values.flat()) if (secretLike(value)) throw new Error('AGENT_EVENT_SECRET_LIKE_CONTENT_REJECTED'); };
const appendEvent = (record, event) => { record.actions = Array.isArray(record.actions) ? [...record.actions, event] : [event]; record.activity = Array.isArray(record.activity) ? [...record.activity, event] : [event]; };

if (!['login', 'event', 'logout', 'message-receive', 'message-consume'].includes(command)) throw new Error('Usage: agent-session.mjs login|event|logout|message-receive|message-consume --session=<id> --agent=<id> --task=<task-id> [--message-file=<path>] [--message-id=<id>]');
if (!sessionId || !agentId || !taskId) throw new Error('Agent session requires --session, --agent and --task.');
if (!roles.has(role)) throw new Error(`Invalid agent role: ${role}`);

fs.mkdirSync(sessionDir, { recursive: true });
fs.mkdirSync(handoffDir, { recursive: true });
const file = sessionPath(sessionId);

if (command === 'event') {
  if (!fs.existsSync(file)) throw new Error('Session not found: ' + sessionId);
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!record.repairProtocol || record.repairProtocol.protocolHash !== assertProtocolDefinition().protocolHash) throw new Error('REPAIR_PROTOCOL_SESSION_HASH_DRIFT');
  if (record.agentId !== agentId) throw new Error('Session owner mismatch: ' + sessionId);
  if (record.taskId !== taskId) throw new Error('AGENT_EVENT_TASK_MISMATCH');
  if (record.status !== 'RUNNING') throw new Error('AGENT_EVENT_REQUIRES_ACTIVE_SESSION');
  const type = String(args.get('type') ?? '').trim().toUpperCase();
  const summary = String(args.get('summary') ?? '').trim();
  const allowed = new Set(['PROGRESS','FINDING','BLOCKER','CHANGE','TEST','VERIFICATION','HANDOFF','NOTE']);
  if (!allowed.has(type)) throw new Error('Invalid event type: ' + (type || 'MISSING'));
  if (!summary) throw new Error('AGENT_EVENT_SUMMARY_REQUIRED');
  const files = split(args.get('files') ?? process.env.FLIXO_AGENT_EVENT_FILES);
  const evidence = split(args.get('evidence') ?? process.env.FLIXO_AGENT_EVENT_EVIDENCE);
  const findings = split(args.get('findings') ?? process.env.FLIXO_AGENT_EVENT_FINDINGS, '|');
  const blockers = split(args.get('blockers') ?? process.env.FLIXO_AGENT_EVENT_BLOCKERS, '|');
  const next = split(args.get('next') ?? process.env.FLIXO_AGENT_EVENT_NEXT, '|');
  const sha = gitSha();
  assertSafeText(type, summary, files, evidence, findings, blockers, next);
  const event = { at: now(), action: 'EVENT', type, summary, sha, files, evidence, findings, blockers, next };
  appendEvent(record, event);
  fs.writeFileSync(file, JSON.stringify(record, null, 2) + '\n');
  const visibilityFile = visibilityPath(sessionId);
  if (!fs.existsSync(visibilityFile)) throw new Error('AGENT_VISIBILITY_RECORD_MISSING');
  const visibility = JSON.parse(fs.readFileSync(visibilityFile, 'utf8'));
  if (visibility.visibilityState !== 'OPEN' || visibility.status !== 'RUNNING') throw new Error('AGENT_VISIBILITY_NOT_OPEN');
  visibility.activity = Array.isArray(visibility.activity) ? [...visibility.activity, event] : [event];
  visibility.lastEvent = event;
  visibility.changedFiles = [...new Set([...(visibility.changedFiles ?? []), ...files])];
  visibility.evidence = [...new Set([...(visibility.evidence ?? []), ...evidence])];
  visibility.findings = [...new Set([...(visibility.findings ?? []), ...findings])];
  visibility.blockers = [...new Set([...(visibility.blockers ?? []), ...blockers])];
  visibility.updatedAt = now();
  writeVisibility(visibility);
  console.log('AGENT_SESSION_EVENT=' + type);
  console.log('AGENT_SESSION_SHA=' + sha);
} else if (command === 'message-receive') {
  if (!rawMessageFile && !rawMessageId) throw new Error('AGENT_MESSAGE_INPUT_REQUIRED');
  if (rawMessageFile) {
    const message = JSON.parse(fs.readFileSync(path.resolve(ROOT, rawMessageFile), 'utf8'));
    const received = ingestAgentMessage(message, gitSha());
    const read = readAgentMessage(received.messageId, agentId, gitSha());
    console.log(JSON.stringify({ status: read.status, messageId: read.messageId, entrySha: read.entrySha, readBy: agentId }, null, 2));
  } else {
    const read = readAgentMessage(rawMessageId, agentId, gitSha());
    console.log(JSON.stringify({ status: read.status, messageId: read.messageId, entrySha: read.entrySha, readBy: agentId }, null, 2));
  }
} else if (command === 'message-consume') {
  if (!rawMessageId) throw new Error('AGENT_MESSAGE_ID_REQUIRED');
  const consumed = consumeAgentMessage(rawMessageId, agentId, gitSha(), messageExecutionAdmitted);
  console.log(JSON.stringify({ status: consumed.status, messageId: consumed.messageId, entrySha: consumed.entrySha, consumedBy: agentId }, null, 2));
} else if (command === 'login') {
  if (fs.existsSync(file)) throw new Error(`Session already exists: ${sessionId}`);
  const missing = requiredReads.filter((entry) => !fs.existsSync(path.resolve(ROOT, entry)));
  if (missing.length) throw new Error(`Mandatory reads missing: ${missing.join(', ')}`);

  const existingHandoffs = fs.readdirSync(handoffDir).filter((entry) => entry.endsWith('.json'));
  let continuation = null;
  if (fromSession) {
    const predecessorFile = handoffPath(fromSession);
    if (!fs.existsSync(predecessorFile)) throw new Error(`Previous handoff report not found: ${fromSession}`);
    const predecessor = JSON.parse(fs.readFileSync(predecessorFile, 'utf8'));
    if (!['VERIFIED', 'BLOCKED'].includes(predecessor.status)) throw new Error(`Previous session is not closed: ${fromSession}`);
    continuation = {
      continuationFrom: fromSession,
      inheritedExitSha: predecessor.exitSha ?? null,
      inheritedRemainingWork: Array.isArray(predecessor.remainingWork) ? predecessor.remainingWork : [],
      inheritedOpenRcas: Array.isArray(predecessor.openRcas) ? predecessor.openRcas : [],
      inheritedNextPlan: Array.isArray(predecessor.executionPlanNext) ? predecessor.executionPlanNext : [],
      predecessorReport: path.relative(ROOT, predecessorFile),
      predecessorTaskId: predecessor.taskId ?? null,
    };
    if (continuation.predecessorTaskId && continuation.predecessorTaskId !== taskId) throw new Error(`CONTINUATION_TASK_MISMATCH=${continuation.predecessorTaskId}`);
  } else if (existingHandoffs.length > 0 && args.get('bootstrap') !== 'true') {
    throw new Error('Continuation handoff required: use --from-session=<previous-session> or explicitly declare --bootstrap=true.');
  }

  const sha = gitSha();
  let inboundMessage = null;
  if (rawMessageFile) {
    inboundMessage = ingestAgentMessage(JSON.parse(fs.readFileSync(path.resolve(ROOT, rawMessageFile), 'utf8')), sha);
    inboundMessage = inboundMessage.status === 'RECEIVED' ? readAgentMessage(inboundMessage.messageId, agentId, sha) : inboundMessage;
  } else if (rawMessageId) {
    inboundMessage = readAgentMessage(rawMessageId, agentId, sha);
  }
  if (inboundMessage && inboundMessage.status !== 'READ' && inboundMessage.status !== 'CONSUMED') {
    throw new Error('AGENT_MESSAGE_NOT_EXECUTION_READY=' + inboundMessage.status);
  }
  const record = {
    schemaVersion: 3,
    repairProtocol: { ...assertProtocolDefinition(), compliance: 'VALIDATED_AT_ENTRY', admission: protocolAdmission },
    sessionId,
    agentId,
    role,
    entrySha: sha,
    baseSha: sha,
    startedAt: now(),
    scope,
    readFiles: [...requiredReads],
    currentRca: rca,
    taskId,
    ...(inboundMessage ? { messageId: inboundMessage.messageId, messageStatus: inboundMessage.status, messageEntrySha: inboundMessage.entrySha, messageReadBy: agentId, messagePriority: 'P0_COMMUNICATION_FIRST' } : {}),
    status: 'RUNNING',
    bootstrap: !continuation,
    ...(continuation ?? {}),
    actions: [{ at: now(), action: 'LOGIN', sha, ...(continuation ? { fromSession } : {}) }],
  };
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, { flag: 'wx' });
  writeVisibility({ schemaVersion: 1, authority: 'AGENT_VISIBILITY_LEDGER', visibilityState: 'OPEN', taskId, sessionId, agentId, role, entrySha: sha, exitSha: null, status: 'RUNNING', finalStatus: null, finalSummary: null, scope, currentRca: rca, rcaClosed: [], openRcas: [], changedFiles: [], commands: [], evidence: [], findings: [], activity: [], lastEvent: null, completedWork: [], failedWork: [], remainingWork: [], executionPlanNext: [], blockers: [], handoffToNextAgent: null, continuationFrom: record.continuationFrom ?? null, inheritedExitSha: record.inheritedExitSha ?? null, startedAt: record.startedAt, updatedAt: now() });
  console.log(`AGENT_SESSION_LOGIN=${sessionId}`);
  console.log(`AGENT_SESSION_SHA=${sha}`);
  console.log(`AGENT_SESSION_FILE=${path.relative(ROOT, file)}`);
  if (continuation) console.log(`AGENT_SESSION_CONTINUATION_FROM=${fromSession}`);
} else {
  if (!fs.existsSync(file)) throw new Error(`Session not found: ${sessionId}`);
  const record = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (record.agentId !== agentId) throw new Error(`Session owner mismatch: ${sessionId}`);
  if (record.status !== 'RUNNING') throw new Error(`Session is not active: ${sessionId}`);

  const status = String(args.get('status') ?? process.env.FLIXO_AGENT_STATUS ?? 'VERIFIED').toUpperCase();
  if (!['VERIFIED', 'BLOCKED'].includes(status)) throw new Error(`Logout status must be VERIFIED or BLOCKED; got ${status}`);
  const sha = gitSha();
  const changedFiles = split(args.get('changed') ?? process.env.FLIXO_AGENT_CHANGED_FILES);
  const commands = split(args.get('commands') ?? process.env.FLIXO_AGENT_COMMANDS, '|');
  const evidence = split(args.get('evidence') ?? process.env.FLIXO_AGENT_EVIDENCE);
  const findings = split(args.get('findings') ?? process.env.FLIXO_AGENT_FINDINGS, '|');
  const rcaClosed = split(args.get('rca-closed') ?? process.env.FLIXO_AGENT_RCA_CLOSED);
  const openRcas = split(args.get('open-rcas') ?? process.env.FLIXO_AGENT_OPEN_RCAS);
  const completedWork = split(args.get('completed-work') ?? process.env.FLIXO_AGENT_COMPLETED_WORK, '|');
  const failedWork = split(args.get('failed-work') ?? process.env.FLIXO_AGENT_FAILED_WORK, '|');
  const remainingWork = split(args.get('remaining-work') ?? process.env.FLIXO_AGENT_REMAINING_WORK, '|');
  const executionPlanNext = split(args.get('next-plan') ?? process.env.FLIXO_AGENT_NEXT_PLAN, '|');
  const blockers = split(args.get('blockers') ?? process.env.FLIXO_AGENT_BLOCKERS, '|');
  const handoffToNextAgent = String(args.get('handoff') ?? process.env.FLIXO_AGENT_HANDOFF ?? '').trim() || null;
  const finalSummary = String(args.get('final-summary') ?? process.env.FLIXO_AGENT_FINAL_SUMMARY ?? '').trim();
  if (!finalSummary) throw new Error('FINAL_SUMMARY_REQUIRED_BEFORE_SESSION_CLOSE');
  if (remainingWork.length === 0 && openRcas.length > 0) {
    throw new Error('Open RCAs exist but remaining-work is empty; session report must preserve unresolved work.');
  }
  if (status === 'VERIFIED' && (failedWork.length > 0 || remainingWork.length > 0 || openRcas.length > 0)) {
    throw new Error('VERIFIED logout requires no failed work, remaining work, or open RCAs; use BLOCKED until continuation work is closed.');
  }
  if (status === 'BLOCKED' && remainingWork.length === 0 && failedWork.length === 0 && openRcas.length === 0) {
    throw new Error('BLOCKED logout requires an explicit unresolved item.');
  }
  if (status === 'VERIFIED' && completedWork.length === 0 && evidence.length === 0) throw new Error('VERIFIED_LOGOUT_REQUIRES_COMPLETED_WORK_OR_EVIDENCE');
  const activity = Array.isArray(record.activity) ? record.activity : [];
  if (status === 'VERIFIED' && activity.length === 0) throw new Error('VERIFIED_LOGOUT_REQUIRES_ACTIVITY_LOG');
  if (record.bootstrap && !record.continuationFrom) {
    // First session may bootstrap the chain, but its logout still establishes the handoff contract.
  }

  record.status = status;
  record.exitSha = sha;
  record.finishedAt = now();
  record.changedFiles = changedFiles;
  record.commands = commands;
  record.evidence = evidence;
  record.findings = findings;
  record.rcaClosed = rcaClosed;
  record.openRcas = openRcas;
  record.handoff = handoffToNextAgent;
  record.finalSummary = finalSummary;
  record.finalStatus = status;
  record.taskId = taskId;
  record.completedWork = completedWork;
  record.failedWork = failedWork;
  record.remainingWork = remainingWork;
  record.executionPlanNext = executionPlanNext;
  record.blockers = blockers;
  record.actions = Array.isArray(record.actions) ? [...record.actions, { at: now(), action: 'LOGOUT', sha, status }] : [{ at: now(), action: 'LOGOUT', sha, status }];
  fs.writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`);

  writeVisibility({ schemaVersion: 1, authority: 'AGENT_VISIBILITY_LEDGER', visibilityState: 'CLOSED', taskId, sessionId: record.sessionId, agentId: record.agentId, role: record.role, entrySha: record.entrySha, exitSha: sha, status, finalStatus: status, finalSummary, scope: record.scope, currentRca: record.currentRca, rcaClosed, openRcas, changedFiles, commands, evidence, findings, activity, lastEvent: activity.at(-1) ?? null, completedWork, failedWork, remainingWork, executionPlanNext, blockers, handoffToNextAgent, continuationFrom: record.continuationFrom ?? null, inheritedExitSha: record.inheritedExitSha ?? null, startedAt: record.startedAt, updatedAt: now() });

  const report = {
    schemaVersion: 1,
    ...(record.messageId ? { messageId: record.messageId, messageEntrySha: record.messageEntrySha, messageStatus: 'HANDOFF_VISIBLE' } : {}),
    reportId: `${sessionId}:${sha}`,
    sessionId: record.sessionId,
    agentId: record.agentId,
    role: record.role,
    taskId,
    finalSummary,
    visibilityPath: path.relative(ROOT, visibilityPath(sessionId)),
    entrySha: record.entrySha,
    exitSha: sha,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    status,
    scope: record.scope,
    currentRca: record.currentRca,
    rcaClosed,
    openRcas,
    changedFiles,
    commands,
    evidence,
    findings,
    completedWork,
    failedWork,
    remainingWork,
    executionPlanNext,
    blockers,
    handoffToNextAgent,
    continuationFrom: record.continuationFrom ?? null,
    inheritedExitSha: record.inheritedExitSha ?? null,
  };
  fs.writeFileSync(handoffPath(sessionId), `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });

  console.log(`AGENT_SESSION_LOGOUT=${sessionId}`);
  console.log(`AGENT_SESSION_SHA=${sha}`);
  console.log(`AGENT_SESSION_STATUS=${status}`);
  console.log(`AGENT_SESSION_HANDOFF=${path.relative(ROOT, handoffPath(sessionId))}`);
}
