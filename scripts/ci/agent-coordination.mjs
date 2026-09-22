#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { getMessage as getAgentMessage, markConsumed as consumeAgentMessage } from './agent-communication.mjs';
import { assertAgentAdmission, assertProtocolDefinition } from './repair-protocol.mjs';
import { buildKnowledgeRecord, persistKnowledge } from './cell-learning.mjs';
import { initialize as initializeChairState, acquire as acquireChair, release as releaseChair, revoke as revokeChair } from './chair-bound-execution.mjs';

const ROOT = process.cwd();
const COORD_DIR = path.resolve(ROOT, process.env.FLIXO_COORDINATION_DIR ?? 'diagnostics/agents');
const QUEUE_FILE = path.join(COORD_DIR, 'coordination-state.json');
const LOCK_FILE = path.join(COORD_DIR, 'coordination-locks.json');
const WRITE_LOCK_DIR = path.join(COORD_DIR, '.coordination-write.lock');
const WRITE_LOCK_OWNER = path.join(WRITE_LOCK_DIR, 'owner.json');
const PACKET_DIR = path.join(COORD_DIR, 'task-packets');
const HANDOFF_DIR = path.join(COORD_DIR, 'handoffs');
const VISIBILITY_DIR = path.resolve(ROOT, process.env.FLIXO_AGENT_VISIBILITY_DIR ?? 'docs/agents/ledger');
const TASK_LEDGER_FILE = path.resolve(ROOT, process.env.FLIXO_TASK_LEDGER_FILE ?? 'المهام.md');
const WRITE_LOCK_WAIT_MS = 50;
const WRITE_LOCK_MAX_ATTEMPTS = 240;
const WRITE_LOCK_STALE_MS = 10 * 60 * 1000;
const STALE_SESSION_KILL_SWITCH = true;
const CHAIR_ROLE_POLICY = Object.freeze({
  chair_1: new Set(['assistantController','executionAgent','repairAgent','assistantRepairAgent','actionRepairBot','actionRepairVerifier','actionHistorian']),
  chair_2: new Set(['verification','reviewAgent','testAgent','securityAgent','diagnosticAgent','errorAgent','repairAgent','assistantRepairAgent','actionRepairVerifier']),
  chair_3: new Set(['analysis','assistantController']),
});
const assertChairRole = (chairId, role) => {
  const allowed = CHAIR_ROLE_POLICY[chairId];
  if (!allowed) throw new Error('CHAIR_UNKNOWN=' + chairId);
  if (!allowed.has(String(role))) throw new Error('CHAIR_ROLE_NOT_AUTHORIZED=' + chairId + ':' + String(role));
};
const COUNCIL_MACHINE_ROLES = new Set(['assistantController','verification','analysis','codeScout','executionAgent','reviewAgent','testAgent','securityAgent','performanceAgent','certificationAuthority','taskAgent','errorAgent','repairAgent','assistantRepairAgent','actionRepairBot','actionRepairVerifier','actionHistorian']);
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
const LEDGER_BLOCKED_RE = /\b(BLOCKED|BLOCKED_EXTERNAL|BLOCKED-UNTIL-GREEN|FROZEN|CANCELLED|DEFER|CLOSED|DONE|HISTORICAL)\b/i;
const LEDGER_READY_RE = /\b(OPEN|READY|EXECUTION-READY|VERIFICATION-PENDING|PLANNED)\b/i;
const parseTaskLedger = () => {
  if (!fs.existsSync(TASK_LEDGER_FILE)) throw new Error('TASK_LEDGER_MISSING');
  const lines = fs.readFileSync(TASK_LEDGER_FILE, 'utf8').split(/\r?\n/u);
  const tasks = new Map();
  const record = (id, lineNumber, status, priority, source) => {
    if (!id || id.includes('..')) return;
    const normalized = String(status ?? '').trim();
    const existing = tasks.get(id);
    if (!existing || lineNumber >= existing.line) {
      tasks.set(id, {
        taskId: id,
        line: lineNumber,
        status: normalized || existing?.status || null,
        priority: Number.isInteger(priority) ? priority : (existing?.priority ?? 50),
        source,
      });
    }
  };
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const heading = line.match(/^#{2,6}\s+.*?\b([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d{1,4})\b.*$/u);
    const table = line.match(/^\|\s*([A-Z][A-Z0-9]*(?:-[A-Z0-9]+)*-\d{1,4})\s*\|\s*([^|]+)\|/u);
    if (!heading && !table) continue;
    const id = (heading ?? table)[1];
    const priorityMatch = line.match(/\bP([0-3])\b/u);
    const priority = priorityMatch ? Number(priorityMatch[1]) : null;
    let status = table ? table[2].trim() : null;
    if (!status) {
      for (const lookahead of lines.slice(index + 1, index + 8)) {
        const statusMatch = lookahead.match(/^STATUS\s*=\s*([^\n]+)/i);
        if (statusMatch) {
          status = statusMatch[1].trim();
          break;
        }
      }
    }
    record(id, index + 1, status, priority, heading ? 'heading' : 'table');
  }
  return [...tasks.values()];
};
const isCouncilPriorityTask = (task) => Boolean(task?.councilPriority === true || task?.councilRole);
const hasPendingCouncilPriorityTask = () => Object.values(state.tasks ?? {}).some((task) => ['READY','QUEUED'].includes(task.status) && isCouncilPriorityTask(task));
const isLedgerTaskEligible = (task) => {
  const status = String(task.status ?? '');
  return Boolean(status) && !LEDGER_BLOCKED_RE.test(status) && LEDGER_READY_RE.test(status);
};
const existingTaskStatusForScheduling = new Set(['READY', 'QUEUED', 'RUNNING', 'DONE']);
const selectNextLedgerTask = (excludedTaskId = null) => {
  if (hasPendingCouncilPriorityTask()) return null;
  const tasks = parseTaskLedger();
  const activeOrKnown = new Set(Object.values(state.tasks ?? {}).filter((task) => existingTaskStatusForScheduling.has(task.status)).map((task) => task.taskId));
  return tasks
    .filter((task) => task.taskId !== excludedTaskId && isLedgerTaskEligible(task))
    .filter((task) => !activeOrKnown.has(task.taskId))
    .sort((left, right) => (left.priority - right.priority) || (left.line - right.line))
    .at(0) ?? null;
};
const materializeLedgerTask = (ledgerTask) => {
  if (!ledgerTask) return null;
  const existing = state.tasks[ledgerTask.taskId];
  if (existing) return existing;
  const task = {
    taskId: ledgerTask.taskId,
    title: `Ledger task: ${ledgerTask.taskId}`,
    priority: ledgerTask.priority,
    lane: 'task-ledger',
    rca: null,
    scope: [],
    objective: 'Execute the next eligible task defined by المهام.md.',
    knownFailure: null,
    evidenceRequired: ['exact-sha', 'targeted-regression'],
    dependsOn: [],
    missionId: `LEDGER:${ledgerTask.taskId}`,
    workPackageId: ledgerTask.taskId,
    councilRole: 'UNASSIGNED',
    councilPriority: false,
    ownerRole: null,
    ownerAgent: null,
    workItems: [],
    acceptanceCriteria: [],
    proofObligations: [],
    handoffTo: 'assistantController',
    status: 'QUEUED',
    sourceOfTruth: 'المهام.md',
    ledgerLine: ledgerTask.line,
    ledgerStatus: ledgerTask.status,
    createdAt: now(),
  };
  state.tasks[task.taskId] = task;
  writeJson(packetPath(task.taskId), {
    schemaVersion: 1,
    ...task,
    entrySha: sha(),
    createdAt: now(),
    nextActions: ['READ المهام.md', 'INGEST HANDOFF', 'LOGIN', 'CLAIM', 'LOCK SCOPE', 'EXECUTE', 'VERIFY'],
    continuation: null,
  });
  return task;
};
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
  const owner = (() => {
    try { return JSON.parse(fs.readFileSync(WRITE_LOCK_OWNER, 'utf8')); }
    catch { return null; }
  })();
  const age = (() => {
    try { return Date.now() - Number(owner?.createdAtMs ?? fs.statSync(WRITE_LOCK_DIR).mtimeMs); }
    catch { return 0; }
  })();
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
const releaseWriteLock = () => { try { fs.rmSync(WRITE_LOCK_DIR, { recursive: true, force: true }); } catch { return false; } };
const storageKey = (value) => createHash('sha256').update(value).digest('hex');
const visibilityPath = (sessionId) => path.join(VISIBILITY_DIR, `${storageKey(sessionId)}.json`);
const packetPath = (taskId) => path.join(PACKET_DIR, `${storageKey(taskId)}.json`);
const readVisibility = (sessionId) => { const file = visibilityPath(sessionId); if (!fs.existsSync(file)) throw new Error(`AGENT_VISIBILITY_RECORD_MISSING=${sessionId}`); return JSON.parse(fs.readFileSync(file, 'utf8')); };
const assertOpenVisibility = (task, sessionId, agentId) => {
  const record = readVisibility(sessionId);
  if (record.visibilityState !== 'OPEN' || record.status !== 'RUNNING') throw new Error(`AGENT_VISIBILITY_NOT_OPEN=${sessionId}`);
  if (record.taskId !== task.taskId) throw new Error('AGENT_VISIBILITY_TASK_MISMATCH');
  if (record.agentId !== agentId) throw new Error('AGENT_VISIBILITY_AGENT_MISMATCH');
  if (record.entrySha && record.entrySha !== sha()) throw new Error('AGENT_VISIBILITY_STALE_ENTRY_SHA');
  if (!task.ownerRole) throw new Error('TASK_OWNER_ROLE_REQUIRED');
  if (!COUNCIL_MACHINE_ROLES.has(String(task.ownerRole))) throw new Error('TASK_OWNER_ROLE_INVALID');
  if (record.role !== task.ownerRole) throw new Error(`TASK_OWNER_ROLE_MISMATCH=${task.ownerRole}`);
  if (task.ownerAgent && record.agentId !== task.ownerAgent) throw new Error('TASK_OWNER_AGENT_MISMATCH');
  if (!task.workPackageId) throw new Error('TASK_WORK_PACKAGE_REQUIRED');
  if (!Array.isArray(task.workItems) || task.workItems.length === 0) throw new Error('TASK_WORK_ITEMS_REQUIRED');
  if (!Array.isArray(task.acceptanceCriteria) || task.acceptanceCriteria.length === 0) throw new Error('TASK_ACCEPTANCE_CRITERIA_REQUIRED');
  if (!Array.isArray(task.proofObligations) || task.proofObligations.length === 0) throw new Error('TASK_PROOF_OBLIGATIONS_REQUIRED');
  const taskScope = new Set(task.scope ?? []);
  const sessionScope = new Set(record.scope ?? []);
  for (const item of taskScope) if (!sessionScope.has(item)) throw new Error(`TASK_SCOPE_NOT_IN_SESSION_SCOPE=${item}`);
  return record;
};
const staleSessionRecord = (sessionId, session, reason) => {
  const staleAtSha = sha();
  state.staleSessions[sessionId] = { ...session, staleAt: now(), staleAtSha, staleReason: reason };
  const task = session.taskId ? state.tasks[session.taskId] : null;
  if (task?.sessionId === sessionId && task.status === 'RUNNING') { task.status = 'STALE'; task.staleReason = reason; task.staleAt = now(); }
  if (session.chairId && session.agentId) {
    revokeChair({ chairId: session.chairId, agentId: session.agentId, reason });
  }
  unlock(sessionId);
  delete state.activeSessions[sessionId];
  try { const file = visibilityPath(sessionId); if (fs.existsSync(file)) { const visibility = JSON.parse(fs.readFileSync(file, 'utf8')); visibility.status = 'STALE'; visibility.staleReason = reason; visibility.staleAt = now(); visibility.updatedAt = now(); fs.writeFileSync(file, JSON.stringify(visibility, null, 2) + '\n'); } } catch { return false; }
};
const reconcileStaleSessions = () => {
  if (!STALE_SESSION_KILL_SWITCH) return;
  const current = sha();
  for (const [sessionId, session] of Object.entries(state.activeSessions)) {
    if (session.entrySha && session.entrySha !== current) staleSessionRecord(sessionId, session, 'ENTRY_SHA_MISMATCH');
    else if (session.governanceFingerprint && session.governanceFingerprint !== currentGovernanceFingerprint) staleSessionRecord(sessionId, session, 'GOVERNANCE_DRIFT');
  }
};
const visibleAgents = () => { if (!fs.existsSync(VISIBILITY_DIR)) return []; return fs.readdirSync(VISIBILITY_DIR).filter((entry) => entry.endsWith('.json')).sort().map((entry) => { try { const item = JSON.parse(fs.readFileSync(path.join(VISIBILITY_DIR, entry), 'utf8')); return { taskId: item.taskId ?? null, sessionId: item.sessionId ?? entry.slice(0,-5), agentId: item.agentId ?? null, role: item.role ?? null, status: item.status ?? null, finalStatus: item.finalStatus ?? null, entrySha: item.entrySha ?? null, exitSha: item.exitSha ?? null, finalSummary: item.finalSummary ?? null, remainingWork: item.remainingWork ?? [], openRcas: item.openRcas ?? [], updatedAt: item.updatedAt ?? null }; } catch { return { sessionId: entry.slice(0,-5), status: 'MALFORMED_EVIDENCE' }; } }); };
const MUTATING_COMMANDS = new Set(['task-create', 'task-claim', 'task-release', 'task-complete', 'task-next', 'ingest-handoff']);
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
function recordCellTaskKnowledge(task, { outcome, verification }) {
  const botId = String(task.ownerAgent ?? '').match(/^CELL-\d{3}$/u)?.[0] ?? null;
  const record = buildKnowledgeRecord({
    botId,
    taskId: task.taskId,
    taskShortName: task.shortName ?? null,
    taskName: task.title ?? task.taskId,
    fingerprint: task.errorFingerprint ?? task.missionId ?? task.taskId,
    rootCause: task.rca ?? 'general-task',
    rule: task.repairStrategy ?? null,
    outcome,
    verification,
    targetSha: sha(),
    failedSha: task.failedSha ?? null,
    runId: process.env.FLIXO_RUN_ID ?? null,
    source: 'FLIXO Agent Coordination / Task Completion',
    changedPaths: Array.isArray(task.scope) ? task.scope : [],
    taskVersion: Number(task.taskVersion ?? 1),
    attempts: Number(task.attempts ?? 1),
    successes: outcome === 'success' ? 1 : 0,
    upgradeNumber: Number(task.upgradeNumber ?? 0),
    upgradePriority: Number(task.upgradePriority ?? 1),
    weakness: task.weakness ?? null,
  });
  return { botId, result: persistKnowledge(record), knowledge: record };
}
ensure();
if (writeLocked) reconcileStaleSessions();
if (!['task-create', 'task-claim', 'task-release', 'task-complete', 'task-next', 'state', 'brief', 'visible', 'ingest-handoff'].includes(command)) throw new Error('Usage: agent-coordination.mjs task-create|task-claim|task-release|task-complete|task-next|state|brief|visible|ingest-handoff');

if (command === 'task-create') {
  const taskId = requireArg('task');
  if (state.tasks[taskId]) throw new Error(`Task already exists: ${taskId}`);
  const ownerRole = optional('owner-role') || null;
  if (ownerRole && !COUNCIL_MACHINE_ROLES.has(ownerRole)) throw new Error('TASK_OWNER_ROLE_INVALID=' + ownerRole);
  const workItems = list('work-items');
  const acceptanceCriteria = list('acceptance');
  const proofObligations = list('proof');
  const task = {
    taskId,
    title: requireArg('title'),
    priority: Number(optional('priority', '50')),
    lane: optional('lane', 'fast-path'),
    rca: optional('rca') || null,
    scope: list('scope'),
    objective: optional('objective'),
    knownFailure: optional('known-failure'),
    evidenceRequired: list('evidence-required'),
    dependsOn: list('depends-on'),
    missionId: optional('mission-id') || `MISSION:${taskId}`,
    workPackageId: optional('work-package') || taskId,
    councilRole: optional('council-role') || null,
    ownerRole,
    ownerAgent: optional('owner-agent') || null,
    workItems,
    acceptanceCriteria,
    proofObligations,
    handoffTo: optional('handoff-to') || 'assistantController',
    status: ownerRole && optional('owner-agent') && workItems.length && acceptanceCriteria.length && proofObligations.length ? 'READY' : 'QUEUED',
    createdAt: now(),
  };
  for (const dep of task.dependsOn) if (!state.tasks[dep]) throw new Error(`Unknown dependency: ${dep}`);
  state.tasks[taskId] = task;
  writeJson(packetPath(taskId), { schemaVersion: 1, ...task, entrySha: sha(), createdAt: now(), nextActions: [], continuation: null });
  save();
  console.log(JSON.stringify(task, null, 2));
}

if (command === 'task-claim') {
  const taskId = requireArg('task'); const sessionId = requireArg('session'); const agentId = requireArg('agent');
  const task = state.tasks[taskId]; if (!task) throw new Error(`Unknown task: ${taskId}`); if (!['READY', 'QUEUED'].includes(task.status)) throw new Error(`Task not claimable: ${task.status}`);
  if (!isCouncilPriorityTask(task) && hasPendingCouncilPriorityTask()) throw new Error('COORDINATION_COUNCIL_PRIORITY_BLOCK');
  for (const dep of task.dependsOn ?? []) if (state.tasks[dep]?.status !== 'DONE') throw new Error(`DEPENDENCY_BLOCK=${dep}`);
  assertOpenVisibility(task, sessionId, agentId);
  const visibility = readVisibility(sessionId);
  let inboundMessage = null;
  const requestedMessageId = optional('message-id');
  const sessionMessageId = visibility.messageId ?? null;
  const messageId = requestedMessageId || sessionMessageId;
  if (messageId) {
    inboundMessage = getAgentMessage(messageId);
    if (!['READ','CONSUMED'].includes(inboundMessage.status)) throw new Error('COORDINATION_MESSAGE_NOT_READ=' + inboundMessage.status);
    if (inboundMessage.entrySha !== sha()) throw new Error('COORDINATION_MESSAGE_SHA_STALE');
    if (!(inboundMessage.recipient === 'ALL_AGENTS' || inboundMessage.recipient === agentId)) throw new Error('COORDINATION_MESSAGE_RECIPIENT_MISMATCH');
    if (inboundMessage.taskId !== taskId) throw new Error('COORDINATION_MESSAGE_TASK_MISMATCH');
    if (!overlap(task.scope ?? [], new Set(inboundMessage.scope ?? []))) throw new Error('COORDINATION_MESSAGE_SCOPE_MISMATCH');
  }
  let lockId = lock(sessionId, agentId, task.rca, task.scope);
  let chairLease = null;
  const selectedChair = optional('chair', 'chair_1');
  assertChairRole(selectedChair, visibility.role);
  try {
    chairLease = acquireTaskChair({ agentId, chairId: selectedChair, reviewId: optional('review-id') || null, scope: task.scope ?? null });
    if (inboundMessage) inboundMessage = consumeAgentMessage(inboundMessage.messageId, agentId, sha(), true);
  } catch (error) {
    try { if (chairLease) releaseTaskChair({ chairId: selectedChair, agentId, reason: 'CLAIM_ROLLBACK' }); } catch {}
    unlock(sessionId);
    throw error;
  }
  task.status = 'RUNNING'; task.claimedBy = agentId; task.sessionId = sessionId; task.claimedAt = now(); task.entrySha = sha(); task.lockId = lockId; task.chairId = selectedChair;
  state.activeSessions[sessionId] = { sessionId, agentId, taskId, lockId, chairId: selectedChair, chairLeaseId: chairLease?.chairs?.[selectedChair]?.lease_id ?? null, entrySha: sha(), governanceFingerprint: currentGovernanceFingerprint, protocolHash: assertProtocolDefinition().protocolHash, ...(inboundMessage ? { messageId: inboundMessage.messageId, messageEntrySha: inboundMessage.entrySha } : {}), updatedAt: now() };
  const packetFile = packetPath(taskId); const packet = readJson(packetFile, task); packet.claim = { sessionId, agentId, lockId, claimedAt: now(), entrySha: sha(), ...(inboundMessage ? { messageId: inboundMessage.messageId, messageEntrySha: inboundMessage.entrySha } : {}) }; writeJson(packetFile, packet); save(); console.log(JSON.stringify(task, null, 2));
}

if (command === 'task-release') {
  const taskId = requireArg('task'); const sessionId = requireArg('session'); const task = state.tasks[taskId]; if (!task) throw new Error(`Unknown task: ${taskId}`); if (task.sessionId !== sessionId) throw new Error('TASK_OWNER_MISMATCH');
  const visibility = readVisibility(sessionId); if (visibility.taskId !== taskId) throw new Error('AGENT_VISIBILITY_TASK_MISMATCH'); if (!['VERIFIED','BLOCKED'].includes(visibility.finalStatus)) throw new Error('TASK_RELEASE_REQUIRES_CLOSED_AGENT_STATUS');
  task.status = optional('status', 'READY').toUpperCase(); task.releasedAt = now(); task.remainingWork = list('remaining-work'); task.openRcas = list('open-rcas'); releaseTaskChair({ chairId: task.chairId, agentId: task.claimedBy, reason: 'TASK_RELEASE', successful: visibility.finalStatus === 'VERIFIED' }); const cellLearning = visibility.finalStatus === 'BLOCKED' ? recordCellTaskKnowledge(task, { outcome: 'blocked', verification: 'task-blocked', sessionId }) : null; unlock(sessionId); delete state.activeSessions[sessionId]; save(); console.log(JSON.stringify({ task, cellLearning }, null, 2));
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
  const cellLearning = recordCellTaskKnowledge(task, { outcome: 'success', verification: 'canonical-task-verified', sessionId });
  task.status = 'DONE'; task.completedAt = now(); task.exitSha = sha(); task.evidence = list('evidence'); task.findings = list('findings'); task.finalStatus = visibility.finalStatus; task.finalSummary = visibility.finalSummary; task.visibilityPath = path.relative(ROOT, visibilityPath(sessionId));
  const ledgerNext = selectNextLedgerTask(taskId);
  if (ledgerNext) {
    const nextTask = materializeLedgerTask(ledgerNext);
    task.nextTask = {
      taskId: nextTask.taskId,
      status: nextTask.status,
      sourceOfTruth: 'المهام.md',
      ledgerLine: ledgerNext.line,
      ledgerStatus: ledgerNext.status,
      priority: ledgerNext.priority,
      assignedAgent: nextTask.ownerAgent ?? null,
      assignedRole: nextTask.ownerRole ?? null,
      councilRole: nextTask.councilRole ?? null,
      entrySha: sha(),
      requiresNewSession: true,
      requiresPresidentAssignment: !nextTask.ownerRole || !nextTask.ownerAgent,
      dispatchReason: 'PREVIOUS_TASK_VERIFIED'
    };
    state.nextDispatch = {
      dispatchId: `TASK-NEXT:${taskId}:${sha()}`,
      completedTaskId: taskId,
      nextTaskId: nextTask.taskId,
      recipient: nextTask.ownerAgent ?? 'assistantController',
      sourceOfTruth: 'المهام.md',
      entrySha: sha(),
      status: nextTask.ownerRole && nextTask.ownerAgent ? 'READY' : 'PENDING_ASSIGNMENT',
      createdAt: now()
    };
  } else {
    task.nextTask = null;
    state.nextDispatch = null;
  }
  releaseTaskChair({ chairId: task.chairId, agentId: task.claimedBy, reason: 'TASK_COMPLETE', successful: true }); unlock(sessionId); delete state.activeSessions[sessionId]; save(); console.log(JSON.stringify({ completedTask: task, cellLearning, nextTask: task.nextTask, councilDispatch: state.nextDispatch }, null, 2));
}

if (command === 'task-next') {
  const completedTaskId = optional('completed-task') || null;
  const ledgerTask = selectNextLedgerTask(completedTaskId);
  if (!ledgerTask) {
    console.log(JSON.stringify({
      schemaVersion: 1,
      authority: 'TASK_LEDGER_COUNCIL_BRIDGE',
      readSha: sha(),
      sourceOfTruth: 'المهام.md',
      status: 'NO_ELIGIBLE_TASK',
      nextTask: null
    }, null, 2));
  } else {
    const task = materializeLedgerTask(ledgerTask);
    const dispatch = {
      dispatchId: `TASK-NEXT:${completedTaskId ?? 'IDLE'}:${sha()}:${task.taskId}`,
      completedTaskId,
      nextTaskId: task.taskId,
      recipient: task.ownerAgent ?? 'assistantController',
      sourceOfTruth: 'المهام.md',
      ledgerLine: ledgerTask.line,
      ledgerStatus: ledgerTask.status,
      priority: ledgerTask.priority,
      ownerRole: task.ownerRole ?? null,
      councilRole: task.councilRole ?? null,
      entrySha: sha(),
      status: task.ownerRole && task.ownerAgent ? 'READY' : 'PENDING_ASSIGNMENT',
      requiresNewSession: true,
      requiresPresidentAssignment: !task.ownerRole || !task.ownerAgent,
      createdAt: now()
    };
    state.nextDispatch = dispatch;
    save();
    console.log(JSON.stringify({ authority: 'TASK_LEDGER_COUNCIL_BRIDGE', sourceOfTruth: 'المهام.md', readSha: sha(), nextTask: task, dispatch }, null, 2));
  }
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
if (command === 'state') {
  const readSha = sha();
  if (state.authoritativeSha && state.authoritativeSha !== readSha) throw new Error('COORDINATION_READ_SHA_STALE');
  console.log(JSON.stringify({ ...state, visibleAgents: visibleAgents(), readSha }, null, 2));
}
if (command === 'brief') {
  const readSha = sha();
  if (state.authoritativeSha && state.authoritativeSha !== readSha) throw new Error('COORDINATION_READ_SHA_STALE');
  if (Number(locks.revision ?? state.revision ?? 0) !== Number(state.revision ?? 0) || (locks.transactionId ?? null) !== (state.transactionId ?? null)) {
    throw new Error('COORDINATION_READ_STATE_MISMATCH');
  }
  const tasks = Object.values(state.tasks ?? {});
  const summarize = (status) => tasks
    .filter((task) => task.status === status)
    .sort((left, right) => Number(left.priority ?? 50) - Number(right.priority ?? 50))
    .slice(0, 8)
    .map((task) => ({ taskId: task.taskId, priority: task.priority, lane: task.lane, scope: task.scope ?? [], status: task.status }));
  const activeLocks = Object.values(locks.locks ?? {}).filter((item) => item.status === 'ACTIVE');
  const activeSessions = Object.values(state.activeSessions ?? {});
  console.log(JSON.stringify({
    schemaVersion: 1,
    authority: 'AGENT_COORDINATION_FAST_READ_PATH',
    readOnly: true,
    readSha,
    revision: state.revision ?? 0,
    transactionId: state.transactionId ?? null,
    counts: {
      ready: tasks.filter((task) => task.status === 'READY').length,
      queued: tasks.filter((task) => task.status === 'QUEUED').length,
      running: tasks.filter((task) => task.status === 'RUNNING').length,
      stale: tasks.filter((task) => task.status === 'STALE').length,
      done: tasks.filter((task) => task.status === 'DONE').length,
      activeSessions: activeSessions.length,
      activeLocks: activeLocks.length,
    },
    readyTasks: summarize('READY'),
    queuedTasks: summarize('QUEUED'),
    runningTasks: summarize('RUNNING'),
    activeAgents: activeSessions.map((session) => ({ sessionId: session.sessionId, agentId: session.agentId, taskId: session.taskId, entrySha: session.entrySha, updatedAt: session.updatedAt })),
    conflicts: activeLocks.map((item) => ({ lockId: item.lockId, sessionId: item.sessionId, agentId: item.agentId, scope: item.scope ?? [], rca: item.rca ?? null })),
    nextLedgerTask: selectNextLedgerTask(null),
    taskLedger: { sourceOfTruth: 'المهام.md', path: path.relative(ROOT, TASK_LEDGER_FILE) },
  }, null, 2));
}
