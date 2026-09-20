#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { getMessage as getAgentMessage, markConsumed as consumeAgentMessage, createMessage, sendMessage, respondToMessage, listPendingResponses } from './agent-communication.mjs';
import { assertAgentAdmission, assertProtocolDefinition } from './repair-protocol.mjs';
import { buildRepairAgentContext, recordAgentLearningEvent } from './auto-repair-learning.mjs';

const ROOT = process.cwd();
const COORD_DIR = path.resolve(ROOT, process.env.FLIXO_COORDINATION_DIR ?? 'diagnostics/agents');
const DEFAULT_TEAM_ID = String(process.env.FLIXO_AGENT_TEAM_ID ?? 'FLIXO-EXECUTION-TEAM').trim();
const QUEUE_FILE = path.join(COORD_DIR, 'coordination-state.json');
const LOCK_FILE = path.join(COORD_DIR, 'coordination-locks.json');
const WRITE_LOCK_DIR = path.join(COORD_DIR, '.coordination-write.lock');
const WRITE_LOCK_OWNER = path.join(WRITE_LOCK_DIR, 'owner.json');
const PACKET_DIR = path.join(COORD_DIR, 'task-packets');
const HANDOFF_DIR = path.join(COORD_DIR, 'handoffs');
const VISIBILITY_DIR = path.resolve(ROOT, process.env.FLIXO_AGENT_VISIBILITY_DIR ?? 'docs/agents/ledger');
const WRITE_LOCK_WAIT_MS = 50;
const WRITE_LOCK_MAX_ATTEMPTS = 240;
const WRITE_LOCK_STALE_MS = 10 * 60 * 1000;
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
const gitBranch = () => execFileSync('git', ['branch', '--show-current'], { cwd: ROOT, encoding: 'utf8' }).trim();
const GOVERNANCE_FILES = ['AGENTS.md', 'docs/AGENT-COLLABORATION-PROTOCOL.md', 'docs/PROTOCOL-HIERARCHY.md', 'docs/PROTOCOL-REGISTRY.json', 'docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json'];
const governanceFingerprint = () => createHash('sha256').update(GOVERNANCE_FILES.map((file) => `${file}:${createHash('sha256').update(fs.readFileSync(path.resolve(ROOT, file), 'utf8'), 'utf8').digest('hex')}`).join('|'), 'utf8').digest('hex');
const assertMutationTopology = () => { if (MUTATING_COMMANDS.has(command) && gitBranch() !== 'execution') throw new Error('COORDINATION_MUTATION_BRANCH_BLOCKED'); };

const requireArg = (name) => { const value = String(args.get(name) ?? '').trim(); if (!value) throw new Error(`Missing --${name}`); return value; };
const optional = (name, fallback = '') => String(args.get(name) ?? fallback).trim();
const list = (name, separator = ',') => optional(name).split(separator).map((v) => v.trim()).filter(Boolean);
const now = () => new Date().toISOString();
const sha = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const ensure = () => { fs.mkdirSync(COORD_DIR, { recursive: true }); fs.mkdirSync(PACKET_DIR, { recursive: true }); fs.mkdirSync(HANDOFF_DIR, { recursive: true }); };
const readJson = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const writeJsonAtomic = (file, value) => {
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
  fs.renameSync(temp, file);
};
const sleepSync = (ms) => { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); };
const pidAlive = (pid) => { try { process.kill(pid, 0); return true; } catch (error) { return error?.code !== 'ESRCH'; } };
const removeStaleWriteLock = () => {
  if (!fs.existsSync(WRITE_LOCK_DIR)) return false;
  let owner;
  try { owner = JSON.parse(fs.readFileSync(WRITE_LOCK_OWNER, 'utf8')); } catch { /* malformed lock metadata is treated as absent */ }
  let age;
  try { age = Date.now() - Number(owner?.createdAtMs ?? fs.statSync(WRITE_LOCK_DIR).mtimeMs); } catch { return false; }
  const sameHostAlive = owner?.hostname === os.hostname() && Number.isInteger(owner?.pid) && pidAlive(owner.pid);
  if (sameHostAlive || age < WRITE_LOCK_STALE_MS) return false;
  fs.rmSync(WRITE_LOCK_DIR, { recursive: true, force: true });
  return true;
};
const acquireWriteLock = () => {
  ensure();
  for (let attempt = 0; attempt < WRITE_LOCK_MAX_ATTEMPTS; attempt += 1) {
    try {
      fs.mkdirSync(WRITE_LOCK_DIR, { recursive: false });
      fs.writeFileSync(WRITE_LOCK_OWNER, JSON.stringify({ pid: process.pid, hostname: os.hostname(), createdAtMs: Date.now() }) + '\n', { flag: 'wx' });
      return;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      removeStaleWriteLock();
      sleepSync(WRITE_LOCK_WAIT_MS);
    }
  }
  throw new Error('COORDINATION_WRITE_LOCK_TIMEOUT');
};
const releaseWriteLock = () => { try { fs.rmSync(WRITE_LOCK_DIR, { recursive: true, force: true }); } catch { /* best-effort cleanup on process exit */ } };
const storageKey = (value) => createHash('sha256').update(value).digest('hex');
const visibilityPath = (sessionId) => path.join(VISIBILITY_DIR, `${storageKey(sessionId)}.json`);
const packetPath = (taskId) => path.join(PACKET_DIR, `${storageKey(taskId)}.json`);
const readVisibility = (sessionId) => { const file = visibilityPath(sessionId); if (!fs.existsSync(file)) throw new Error(`AGENT_VISIBILITY_RECORD_MISSING=${sessionId}`); return JSON.parse(fs.readFileSync(file, 'utf8')); };
const assertOpenVisibility = (task, sessionId, agentId) => { const record = readVisibility(sessionId); if (record.visibilityState !== 'OPEN' || record.status !== 'RUNNING') throw new Error(`AGENT_VISIBILITY_NOT_OPEN=${sessionId}`); if (record.taskId !== task.taskId) throw new Error('AGENT_VISIBILITY_TASK_MISMATCH'); if (record.agentId !== agentId) throw new Error('AGENT_VISIBILITY_AGENT_MISMATCH'); if (record.entrySha && record.entrySha !== sha()) throw new Error('AGENT_VISIBILITY_STALE_ENTRY_SHA'); return record; };
const staleSessionRecord = (sessionId, session, reason) => {
  const staleAtSha = sha();
  state.staleSessions[sessionId] = { ...session, staleAt: now(), staleAtSha, staleReason: reason };
  const task = session.taskId ? state.tasks[session.taskId] : null;
  if (task?.sessionId === sessionId && task.status === 'RUNNING') { task.status = 'STALE'; task.staleReason = reason; task.staleAt = now(); }
  unlock(sessionId);
  delete state.activeSessions[sessionId];
  try { const file = visibilityPath(sessionId); if (fs.existsSync(file)) { const visibility = JSON.parse(fs.readFileSync(file, 'utf8')); visibility.status = 'STALE'; visibility.staleReason = reason; visibility.staleAt = now(); visibility.updatedAt = now(); fs.writeFileSync(file, JSON.stringify(visibility, null, 2) + '\n'); } } catch {}
};
const reconcileStaleSessions = () => {
  const current = sha();
  for (const [sessionId, session] of Object.entries(state.activeSessions)) {
    if (session.entrySha && session.entrySha !== current) staleSessionRecord(sessionId, session, 'ENTRY_SHA_MISMATCH');
    else if (session.governanceFingerprint && session.governanceFingerprint !== currentGovernanceFingerprint) staleSessionRecord(sessionId, session, 'GOVERNANCE_DRIFT');
  }
};
const visibleAgents = () => { if (!fs.existsSync(VISIBILITY_DIR)) return []; return fs.readdirSync(VISIBILITY_DIR).filter((entry) => entry.endsWith('.json')).sort().map((entry) => { try { const item = JSON.parse(fs.readFileSync(path.join(VISIBILITY_DIR, entry), 'utf8')); return { taskId: item.taskId ?? null, sessionId: item.sessionId ?? entry.slice(0,-5), agentId: item.agentId ?? null, role: item.role ?? null, status: item.status ?? null, finalStatus: item.finalStatus ?? null, entrySha: item.entrySha ?? null, exitSha: item.exitSha ?? null, finalSummary: item.finalSummary ?? null, remainingWork: item.remainingWork ?? [], openRcas: item.openRcas ?? [], updatedAt: item.updatedAt ?? null }; } catch { return { sessionId: entry.slice(0,-5), status: 'MALFORMED_EVIDENCE' }; } }); };
const MUTATING_COMMANDS = new Set(['task-create', 'task-claim', 'task-release', 'task-complete', 'ingest-handoff', 'state', 'coop-request', 'coop-challenge', 'coop-handoff', 'coop-respond']);
const writeLocked = MUTATING_COMMANDS.has(command);
assertMutationTopology();
if (writeLocked) acquireWriteLock();
process.on('exit', releaseWriteLock);
const defaultState = () => ({ schemaVersion: 1, authority: 'AGENT_COORDINATION_CONTROL_PLANE', authoritativeSha: sha(), governanceFingerprint: governanceFingerprint(), revision: 0, transactionId: null, updatedAt: now(), tasks: {}, activeSessions: {}, staleSessions: {} });
const defaultLocks = () => ({ schemaVersion: 1, authority: 'AGENT_SCOPE_LOCKS', governanceFingerprint: governanceFingerprint(), revision: 0, transactionId: null, locks: {} });
const state = readJson(QUEUE_FILE, defaultState());
const locks = readJson(LOCK_FILE, defaultLocks());
state.staleSessions = state.staleSessions ?? {};
const currentGovernanceFingerprint = governanceFingerprint();
if (state.governanceFingerprint && state.governanceFingerprint !== currentGovernanceFingerprint) throw new Error('COORDINATION_GOVERNANCE_DRIFT');
if (locks.governanceFingerprint && locks.governanceFingerprint !== currentGovernanceFingerprint) throw new Error('COORDINATION_GOVERNANCE_DRIFT');
state.governanceFingerprint = currentGovernanceFingerprint;
locks.governanceFingerprint = currentGovernanceFingerprint;
let initialRevision = Number(state.revision ?? 0);
if (Number(locks.revision ?? initialRevision) !== initialRevision) throw new Error('COORDINATION_STATE_VERSION_MISMATCH');
if ((locks.transactionId ?? null) !== (state.transactionId ?? null)) throw new Error('COORDINATION_TRANSACTION_MISMATCH');
function repairAgentContextPath() { return path.resolve(ROOT, 'diagnostics/auto-repair/repair-agent-context.json'); }
function publishRepairAgentContext() {
  const context = buildRepairAgentContext({ teamId: DEFAULT_TEAM_ID, currentSha: sha(), tasks: Object.values(state.tasks ?? {}), activeSessions: Object.values(state.activeSessions ?? {}) });
  fs.mkdirSync(path.dirname(repairAgentContextPath()), { recursive: true });
  fs.writeFileSync(repairAgentContextPath(), JSON.stringify(context, null, 2) + '\n');
}
function save() {
  const persisted = readJson(QUEUE_FILE, defaultState());
  const persistedLocks = readJson(LOCK_FILE, defaultLocks());
  if (Number(persisted.revision ?? 0) !== initialRevision || Number(persistedLocks.revision ?? initialRevision) !== initialRevision) throw new Error('COORDINATION_STATE_VERSION_CONFLICT');
  const governance = governanceFingerprint();
  if ((persisted.governanceFingerprint ?? governance) !== governance || (persistedLocks.governanceFingerprint ?? governance) !== governance) throw new Error('COORDINATION_GOVERNANCE_DRIFT');
  const nextRevision = initialRevision + 1;
  const transactionId = `${sha()}:${nextRevision}:${process.pid}:${Date.now()}`;
  const nextState = { ...state, authoritativeSha: sha(), governanceFingerprint: governance, revision: nextRevision, transactionId, updatedAt: now() };
  const nextLocks = { ...locks, governanceFingerprint: governance, revision: nextRevision, transactionId };
  writeJsonAtomic(QUEUE_FILE, nextState);
  writeJsonAtomic(LOCK_FILE, nextLocks);
  Object.assign(state, { authoritativeSha: nextState.authoritativeSha, revision: nextRevision, transactionId, updatedAt: nextState.updatedAt });
  Object.assign(locks, { revision: nextRevision, transactionId });
  initialRevision = nextRevision;
  publishRepairAgentContext();
}
function overlap(a, b) { return a.some((x) => b.has(x)); }
function lock(sessionId, agentId, rca, scope) {
  for (const [id, item] of Object.entries(locks.locks)) {
    if (item.status !== 'ACTIVE' || item.sessionId === sessionId) continue;
    if ((rca && item.rca && rca === item.rca) || overlap(scope, new Set(item.scope ?? []))) throw new Error(`COORDINATION_CONFLICT=${id}`);
  }
  const lockId = `${sessionId}:${sha()}`;
  locks.locks[lockId] = { lockId, sessionId, agentId, rca: rca || null, scope, entrySha: sha(), governanceFingerprint: currentGovernanceFingerprint, acquiredAt: now(), status: 'ACTIVE' };
  return lockId;
}
function unlock(sessionId) { for (const item of Object.values(locks.locks)) if (item.sessionId === sessionId && item.status === 'ACTIVE') { item.status = 'RELEASED'; item.releasedAt = now(); } }

function unresolvedRequiredTasks(excludeTaskId = null) {
  return Object.values(state.tasks ?? {}).filter((task) =>
    task.taskId !== excludeTaskId && ['READY', 'QUEUED', 'RUNNING', 'STALE'].includes(task.status)
  );
}

function activePeerSessions(excludeSessionId = null, teamId = DEFAULT_TEAM_ID) {
  return Object.values(state.activeSessions ?? {}).filter((session) =>
    session.sessionId !== excludeSessionId && String(session.teamId ?? DEFAULT_TEAM_ID) === String(teamId) && !['CLOSED', 'STALE'].includes(String(session.collaborationState ?? ''))
  );
}

function chooseContinuationTarget(excludeSessionId, teamId = DEFAULT_TEAM_ID) {
  return activePeerSessions(excludeSessionId, teamId)
    .filter((session) => session.entrySha === sha())
    .sort((a, b) => String(a.updatedAt ?? '').localeCompare(String(b.updatedAt ?? '')))[0] ?? null;
}

function chooseContinuationTask(sessionId) {
  const candidates = Object.values(state.tasks ?? {})
    .filter((task) => ['READY', 'QUEUED'].includes(task.status))
    .filter((task) => (task.dependsOn ?? []).every((dep) => state.tasks[dep]?.status === 'DONE'))
    .sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0));
  for (const task of candidates) {
    try {
      const lockId = lock(sessionId, state.activeSessions[sessionId]?.agentId ?? 'continuation-agent', task.rca, task.scope ?? []);
      return { task, lockId };
    } catch (error) {
      if (!String(error?.message ?? error).startsWith('COORDINATION_CONFLICT=')) throw error;
    }
  }
  return null;
}

function mandatoryContinuation(sessionId, agentId, completedTaskId, teamId = DEFAULT_TEAM_ID) {
  const peer = chooseContinuationTarget(sessionId, teamId);
  const remaining = unresolvedRequiredTasks(completedTaskId).filter((task) => String(task.teamId ?? DEFAULT_TEAM_ID) === String(teamId));
  const teamPeers = activePeerSessions(sessionId, teamId);
  const allPeersReady = teamPeers.every((peerSession) => peerSession.readyForTeamClose === true);
  if (remaining.length === 0 && allPeersReady) {
    const current = state.activeSessions[sessionId];
    if (current) {
      current.taskId = null;
      current.teamId = teamId;
      current.completedTaskId = completedTaskId;
      current.collaborationState = 'READY_TO_CLOSE';
      current.collaborationRequired = false;
      current.teamBarrier = 'READY_TO_CLOSE';
      current.readyForTeamClose = true;
      current.requiredUntil = 'TEAM_CLOSURE';
      current.updatedAt = now();
      const visibility = readVisibility(sessionId);
      visibility.continuation = { required: false, previousTaskId: completedTaskId, mode: 'TEAM_READY_TO_CLOSE' };
      visibility.updatedAt = now();
      fs.writeFileSync(visibilityPath(sessionId), JSON.stringify(visibility, null, 2) + '\n');
      return { state: 'TEAM_READY_TO_CLOSE', targetSessionId: null, assignedTaskId: null };
    }
  }
  if (!peer && remaining.length === 0) return { state: 'NONE' };

  const current = state.activeSessions[sessionId];
  if (!current) return { state: 'JOIN_REQUIRED', targetSessionId: peer?.sessionId ?? null, reason: 'ACTIVE_WORK_REMAINS' };

  const next = chooseContinuationTask(sessionId);
  if (next) {
    const task = next.task;
    task.status = 'RUNNING';
    task.claimedBy = agentId;
    task.sessionId = sessionId;
    task.claimedAt = now();
    task.entrySha = sha();
    task.lockId = next.lockId;

    current.taskId = task.taskId;
    current.teamId = teamId;
    current.completedTaskId = completedTaskId;
    current.joinedToSessionId = peer?.sessionId ?? null;
    current.collaborationState = peer ? 'JOINED' : 'CONTINUING';
    current.collaborationRequired = true;
    current.teamBarrier = 'ACTIVE';
    current.entrySha = sha();
    current.updatedAt = now();

    if (peer) {
      peer.collaborators = Array.isArray(peer.collaborators) ? peer.collaborators : [];
      peer.collaborators.push({
        sessionId,
        agentId,
        taskId: task.taskId,
        joinedAt: now(),
        entrySha: sha(),
        status: 'ACTIVE',
      });
      peer.updatedAt = now();
    }

    const packetFile = packetPath(task.taskId);
    const packet = readJson(packetFile, task);
    packet.claim = {
      sessionId,
      agentId,
      joinedToSessionId: peer?.sessionId ?? null,
      claimedAt: now(),
      entrySha: sha(),
      mandatoryContinuation: true,
    };
    writeJson(packetFile, packet);

    const visibility = readVisibility(sessionId);
    visibility.taskId = task.taskId;
    visibility.finalStatus = null;
    visibility.finalSummary = null;
    visibility.status = 'RUNNING';
    visibility.visibilityState = 'OPEN';
    visibility.continuation = {
      required: true,
      joinedToSessionId: peer?.sessionId ?? null,
      previousTaskId: completedTaskId,
      assignedTaskId: task.taskId,
      assignedAt: now(),
    };
    visibility.activity = Array.isArray(visibility.activity) ? [...visibility.activity, {
      at: now(),
      type: 'MANDATORY_JOIN',
      summary: peer ? 'Completed agent automatically joined an active agent and claimed the next required task.' : 'Completed agent automatically continued into the next required task.',
      joinedToSessionId: peer?.sessionId ?? null,
      taskId: task.taskId,
      entrySha: sha(),
    }] : [];
    visibility.updatedAt = now();
    fs.writeFileSync(visibilityPath(sessionId), JSON.stringify(visibility, null, 2) + '\n');

    return {
      state: peer ? 'JOINED' : 'CONTINUING',
      targetSessionId: peer?.sessionId ?? null,
      assignedTaskId: task.taskId,
      assignedTaskTitle: task.title,
    };
  }

  current.taskId = null;
  current.teamId = teamId;
  current.completedTaskId = completedTaskId;
  current.joinedToSessionId = peer?.sessionId ?? null;
  current.collaborationState = peer ? 'JOINED_SUPPORT' : 'JOIN_REQUIRED';
  current.collaborationRequired = true;
  current.teamBarrier = remaining.length === 0 && activePeerSessions(sessionId, teamId).every((peerSession) => peerSession.readyForTeamClose === true) ? 'READY_TO_CLOSE' : 'WAITING_FOR_TEAM';
  current.requiredUntil = 'ALL_TEAM_WORK_CLOSED';
  current.updatedAt = now();
  if (peer) {
    peer.collaborators = Array.isArray(peer.collaborators) ? peer.collaborators : [];
    peer.collaborators.push({
      sessionId,
      agentId,
      taskId: peer.taskId ?? null,
      joinedAt: now(),
      entrySha: sha(),
      status: 'SUPPORT_ACTIVE',
    });
    peer.updatedAt = now();
  }

  const visibility = readVisibility(sessionId);
  visibility.continuation = {
    required: true,
    joinedToSessionId: peer?.sessionId ?? null,
    previousTaskId: completedTaskId,
    mode: peer ? 'SUPPORT_UNTIL_ACTIVE_TEAM_CLOSES' : 'WAIT_FOR_REQUIRED_WORK',
  };
  visibility.activity = Array.isArray(visibility.activity) ? [...visibility.activity, {
    at: now(),
    type: 'MANDATORY_JOIN',
    summary: peer ? 'Completed agent joined the active agent team in mandatory support mode until all required work closes.' : 'Completed agent remains active because required work remains but no claimable task is available.',
    joinedToSessionId: peer?.sessionId ?? null,
    entrySha: sha(),
  }] : [];
  visibility.updatedAt = now();
  fs.writeFileSync(visibilityPath(sessionId), JSON.stringify(visibility, null, 2) + '\n');

  return {
    state: peer ? 'JOINED_SUPPORT' : 'JOIN_REQUIRED',
    targetSessionId: peer?.sessionId ?? null,
    assignedTaskId: null,
  };
}
ensure();
if (writeLocked) reconcileStaleSessions();
if (!['task-create', 'task-claim', 'task-release', 'task-complete', 'state', 'visible', 'ingest-handoff', 'coop-request', 'coop-challenge', 'coop-handoff', 'coop-respond', 'coop-pending'].includes(command)) throw new Error('Usage: agent-coordination.mjs task-create|task-claim|task-release|task-complete|state|visible|ingest-handoff|coop-request|coop-challenge|coop-handoff|coop-respond|coop-pending');

if (['coop-request','coop-challenge','coop-handoff'].includes(command)) {
  const type = command === 'coop-request' ? 'REQUEST' : command === 'coop-challenge' ? 'CHALLENGE' : 'HANDOFF';
  const agent = requireArg('agent');
  const recipient = requireArg('recipient');
  const taskId = requireArg('task');
  const scope = list('scope');
  if (!scope.length) throw new Error('COOPERATION_SCOPE_REQUIRED');
  const message = createMessage({
    messageId: optional('message-id', ''), actor: agent, recipient, intent: requireArg('intent'), taskId, scope, entrySha: sha(),
    risk: optional('risk', 'MEDIUM').toUpperCase(), dependencies: list('depends-on').length ? list('depends-on') : ['coordination'],
    expectedEvidence: list('evidence').length ? list('evidence') : ['response-receipt'],
    stopConditions: list('stop').length ? list('stop') : ['scope-conflict','stale-sha','authority-conflict'],
    proofObligations: list('proof').length ? list('proof') : ['exact-sha','response-correlation'],
    messageType: type, requiresResponse: true, payload: optional('payload') || null, source: 'agent-coordination'
  }, sha());
  console.log(JSON.stringify(sendMessage(message, sha()), null, 2));
}

if (command === 'coop-respond') {
  console.log(JSON.stringify(respondToMessage({ requestId: requireArg('reply-to'), actor: requireArg('agent'), responseStatus: optional('response-status', 'ACKNOWLEDGED').toUpperCase(), intent: optional('intent', ''), payload: optional('payload') || null }, sha()), null, 2));
}

if (command === 'coop-pending') {
  console.log(JSON.stringify(listPendingResponses(requireArg('agent')), null, 2));
}
if (command === 'task-create') {
  const taskId = requireArg('task');
  if (state.tasks[taskId]) throw new Error(`Task already exists: ${taskId}`);
  const task = { taskId, teamId: optional('team', DEFAULT_TEAM_ID), title: requireArg('title'), priority: Number(optional('priority', '50')), lane: optional('lane', 'fast-path'), rca: optional('rca') || null, scope: list('scope'), objective: optional('objective'), knownFailure: optional('known-failure'), evidenceRequired: list('evidence-required'), dependsOn: list('depends-on'), status: 'READY', createdAt: now() };
  for (const dep of task.dependsOn) if (!state.tasks[dep]) throw new Error(`Unknown dependency: ${dep}`);
  recordAgentLearningEvent({ teamId: task.teamId, eventType: 'TASK_CREATED', taskId, actor: 'assistantController', entrySha: sha(), information: `Task created: ${task.title}`, lesson: `Repair Agent must know this task before subsequent repair decisions.`, evidence: [task.scope, task.evidenceRequired].flat().filter(Boolean) });
  state.tasks[taskId] = task;
  writeJson(packetPath(taskId), { schemaVersion: 1, ...task, entrySha: sha(), createdAt: now(), nextActions: [], continuation: null });
  save();
  console.log(JSON.stringify(task, null, 2));
}

if (command === 'task-claim') {
  const taskId = requireArg('task'); const sessionId = requireArg('session'); const agentId = requireArg('agent'); const teamId = optional('team', DEFAULT_TEAM_ID);
  const task = state.tasks[taskId]; if (!task) throw new Error(`Unknown task: ${taskId}`); if (String(task.teamId ?? DEFAULT_TEAM_ID) !== String(teamId)) throw new Error('TEAM_ID_MISMATCH'); if (!['READY', 'QUEUED'].includes(task.status)) throw new Error(`Task not claimable: ${task.status}`);
  for (const dep of task.dependsOn ?? []) if (state.tasks[dep]?.status !== 'DONE') throw new Error(`DEPENDENCY_BLOCK=${dep}`);
  assertOpenVisibility(task, sessionId, agentId);
  const visibility = readVisibility(sessionId);
  let inboundMessage = null;
  const requestedMessageId = optional('message-id');
  const sessionMessageId = visibility.messageId ?? null;
  const messageId = requestedMessageId || sessionMessageId;
  if (messageId) {
    inboundMessage = getAgentMessage(messageId);
    const messageType = String(inboundMessage.messageType ?? 'DIRECTIVE');
    if (messageType === 'RESPONSE') throw new Error('COORDINATION_RESPONSE_NOT_TASK_DIRECTIVE');
    if (messageType === 'CHALLENGE') throw new Error('COORDINATION_CHALLENGE_REQUIRES_RESPONSE');
    if (messageType === 'REQUEST' && inboundMessage.responseState !== 'RESPONDED') throw new Error('COORDINATION_REQUEST_REQUIRES_RESPONSE');
    if (messageType === 'REQUEST' && inboundMessage.responseStatus !== 'ACCEPTED') throw new Error('COORDINATION_REQUEST_NOT_ACCEPTED');
    if (messageType === 'HANDOFF' && !['ACCEPTED','ACKNOWLEDGED'].includes(String(inboundMessage.responseStatus))) throw new Error('COORDINATION_HANDOFF_NOT_ACKNOWLEDGED');
    if (!['READ','CONSUMED'].includes(inboundMessage.status)) throw new Error('COORDINATION_MESSAGE_NOT_READ=' + inboundMessage.status);
    if (inboundMessage.entrySha !== sha()) throw new Error('COORDINATION_MESSAGE_SHA_STALE');
    if (!(inboundMessage.recipient === 'ALL_AGENTS' || inboundMessage.recipient === agentId)) throw new Error('COORDINATION_MESSAGE_RECIPIENT_MISMATCH');
    if (inboundMessage.taskId !== taskId) throw new Error('COORDINATION_MESSAGE_TASK_MISMATCH');
    if (!overlap(task.scope ?? [], new Set(inboundMessage.scope ?? []))) throw new Error('COORDINATION_MESSAGE_SCOPE_MISMATCH');
  }
  let lockId = lock(sessionId, agentId, task.rca, task.scope);
  if (inboundMessage) {
    try {
      inboundMessage = consumeAgentMessage(inboundMessage.messageId, agentId, sha(), true);
    } catch (error) {
      unlock(sessionId);
      throw error;
    }
  }
  recordAgentLearningEvent({ teamId, eventType: 'TASK_CLAIMED', taskId, actor: agentId, entrySha: sha(), information: `Task claimed by ${agentId}: ${task.title}`, lesson: `Repair Agent observes active ownership and scope before advising further work.`, evidence: task.scope ?? [] });
  task.status = 'RUNNING'; task.claimedBy = agentId; task.sessionId = sessionId; task.claimedAt = now(); task.entrySha = sha(); task.lockId = lockId;
  state.activeSessions[sessionId] = { sessionId, agentId, taskId, teamId, lockId, entrySha: sha(), governanceFingerprint: currentGovernanceFingerprint, protocolHash: assertProtocolDefinition().protocolHash, collaborationState: 'ACTIVE', collaborationRequired: true, teamBarrier: 'ACTIVE', readyForTeamClose: false, ...(inboundMessage ? { messageId: inboundMessage.messageId, messageEntrySha: inboundMessage.entrySha } : {}), updatedAt: now() };
  const packetFile = packetPath(taskId); const packet = readJson(packetFile, task); packet.claim = { sessionId, agentId, lockId, claimedAt: now(), entrySha: sha(), ...(inboundMessage ? { messageId: inboundMessage.messageId, messageEntrySha: inboundMessage.entrySha } : {}) }; writeJson(packetFile, packet); save(); console.log(JSON.stringify(task, null, 2));
}

if (command === 'task-release') {
  const taskId = requireArg('task'); const sessionId = requireArg('session'); const task = state.tasks[taskId]; if (!task) throw new Error(`Unknown task: ${taskId}`); if (task.sessionId !== sessionId) throw new Error('TASK_OWNER_MISMATCH');
  const visibility = readVisibility(sessionId); if (visibility.taskId !== taskId) throw new Error('AGENT_VISIBILITY_TASK_MISMATCH'); if (!['VERIFIED','BLOCKED'].includes(visibility.finalStatus)) throw new Error('TASK_RELEASE_REQUIRES_CLOSED_AGENT_STATUS');
  task.status = optional('status', 'READY').toUpperCase(); task.releasedAt = now(); task.remainingWork = list('remaining-work'); task.openRcas = list('open-rcas'); unlock(sessionId); delete state.activeSessions[sessionId]; save(); console.log(JSON.stringify(task, null, 2));
}

if (command === 'task-complete') {
  const taskId = requireArg('task'); const sessionId = requireArg('session'); const task = state.tasks[taskId]; if (!task) throw new Error(`Unknown task: ${taskId}`); if (task.sessionId !== sessionId) throw new Error('TASK_OWNER_MISMATCH');
  const openRcas = list('open-rcas'); const remainingWork = list('remaining-work'); if (openRcas.length || remainingWork.length) throw new Error('TASK_COMPLETION_BLOCKED_BY_UNRESOLVED_WORK');
  const visibility = readVisibility(sessionId);
  const handoffFile = path.join(HANDOFF_DIR, `${storageKey(sessionId)}.json`);
  if (!fs.existsSync(handoffFile)) throw new Error('TASK_COMPLETION_REQUIRES_AGENT_HANDOFF');
  const handoff = JSON.parse(fs.readFileSync(handoffFile, 'utf8'));
  if (handoff.status !== 'VERIFIED' || visibility.finalStatus !== 'VERIFIED') throw new Error('TASK_COMPLETION_REQUIRES_VERIFIED_AGENT_STATUS');
  if (handoff.taskId !== taskId || visibility.taskId !== taskId) throw new Error('TASK_COMPLETION_TASK_MISMATCH');
  if (handoff.exitSha !== sha() || visibility.exitSha !== sha()) throw new Error('TASK_COMPLETION_STALE_EXIT_SHA');
  if (!visibility.finalSummary) throw new Error('TASK_COMPLETION_FINAL_SUMMARY_MISSING');
  recordAgentLearningEvent({ teamId: String(state.activeSessions[sessionId]?.teamId ?? task.teamId ?? DEFAULT_TEAM_ID), eventType: 'TASK_COMPLETED', taskId, actor: task.claimedBy ?? null, entrySha: sha(), information: `Task completed: ${task.title}`, lesson: 'Repair Agent receives the completed task result and remaining team state before the next repair decision.', evidence: [...(task.evidence ?? []), ...(task.findings ?? [])] });
  task.status = 'DONE'; task.completedAt = now(); task.exitSha = sha(); task.evidence = list('evidence'); task.findings = list('findings'); task.finalStatus = visibility.finalStatus; task.finalSummary = visibility.finalSummary; task.visibilityPath = path.relative(ROOT, visibilityPath(sessionId));
  unlock(sessionId);

  const teamId = String((state.activeSessions[sessionId]?.teamId ?? task.teamId ?? DEFAULT_TEAM_ID));
  const teamWorkRemaining = unresolvedRequiredTasks(taskId).filter((candidate) => String(candidate.teamId ?? DEFAULT_TEAM_ID) === String(teamId));
  const continuation = mandatoryContinuation(sessionId, task.claimedBy, taskId, teamId);
  const session = state.activeSessions[sessionId] ?? { sessionId, agentId: task.claimedBy, teamId, entrySha: sha(), governanceFingerprint: currentGovernanceFingerprint, protocolHash: assertProtocolDefinition().protocolHash };
  session.teamId = teamId;
  session.completedTaskIds = [...new Set([...(session.completedTaskIds ?? []), taskId])];
  session.readyForTeamClose = teamWorkRemaining.length === 0;
  session.updatedAt = now();
  state.activeSessions[sessionId] = session;
  state.activeSessions[sessionId] = state.activeSessions[sessionId] ?? { sessionId, agentId: task.claimedBy, entrySha: sha(), governanceFingerprint: currentGovernanceFingerprint, protocolHash: assertProtocolDefinition().protocolHash, updatedAt: now() };
  if (continuation.state === 'NONE') {
    state.activeSessions[sessionId].taskId = null;
    state.activeSessions[sessionId].collaborationState = 'WAITING_FOR_TEAM';
    state.activeSessions[sessionId].collaborationRequired = true;
    state.activeSessions[sessionId].teamBarrier = 'READY_TO_CLOSE';
    state.activeSessions[sessionId].readyForTeamClose = true;
    state.activeSessions[sessionId].updatedAt = now();
  }
  save();
  console.log(JSON.stringify({ ...task, mandatoryContinuation: continuation }, null, 2));
}

if (command === 'ingest-handoff') {
  const previous = requireArg('from-session');
  const file = path.join(HANDOFF_DIR, `${storageKey(previous)}.json`);
  if (!fs.existsSync(file)) throw new Error(`HANDOFF_NOT_FOUND=${previous}`);
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!['VERIFIED', 'BLOCKED'].includes(report.status)) throw new Error('PREDECESSOR_NOT_CLOSED');
  const currentSha = sha();
  if (!/^[a-f0-9]{40}$/u.test(String(report.exitSha ?? '')) || report.exitSha !== currentSha) throw new Error('HANDOFF_STALE_EXIT_SHA');
  const sessionId = requireArg('session');
  const agentId = requireArg('agent');
  const role = optional('role', 'implementation');
  assertAgentAdmission({ actor: role, branch: gitBranch(), mutation: false });
  const taskId = optional('task', String(report.taskId ?? ''));
  if (!taskId || report.taskId !== taskId) throw new Error('HANDOFF_TASK_MISMATCH');
  if (state.activeSessions[sessionId]) throw new Error('SESSION_ALREADY_ACTIVE');
  const requestedScope = list('scope');
  const predecessorScope = new Set(report.scope ?? []);
  if (requestedScope.some((item) => !predecessorScope.has(item))) throw new Error('HANDOFF_SCOPE_EXPANSION_BLOCKED');
  state.activeSessions[sessionId] = {
    sessionId,
    agentId,
    role,
    taskId,
    continuationFrom: previous,
    inheritedExitSha: report.exitSha,
    entrySha: currentSha,
    governanceFingerprint: currentGovernanceFingerprint,
    protocolHash: assertProtocolDefinition().protocolHash,
    inheritedRemainingWork: report.remainingWork ?? [],
    inheritedOpenRcas: report.openRcas ?? [],
    inheritedNextPlan: report.executionPlanNext ?? [],
    updatedAt: now(),
  };
  save();
  console.log(JSON.stringify(state.activeSessions[sessionId], null, 2));
}
if (command === 'visible') { console.log(JSON.stringify(visibleAgents(), null, 2)); }
if (command === 'state') { save(); console.log(JSON.stringify({ ...state, visibleAgents: visibleAgents() }, null, 2)); }
