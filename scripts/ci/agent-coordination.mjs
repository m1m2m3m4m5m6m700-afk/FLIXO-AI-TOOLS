#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { getMessage as getAgentMessage, markConsumed as consumeAgentMessage } from './agent-communication.mjs';

const ROOT = process.cwd();
const COORD_DIR = path.resolve(ROOT, 'diagnostics/agents');
const QUEUE_FILE = path.join(COORD_DIR, 'coordination-state.json');
const LOCK_FILE = path.join(COORD_DIR, 'coordination-locks.json');
const PACKET_DIR = path.join(COORD_DIR, 'task-packets');
const HANDOFF_DIR = path.join(COORD_DIR, 'handoffs');
const VISIBILITY_DIR = path.resolve(ROOT, 'docs/agents/ledger');
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
const requireArg = (name) => { const value = String(args.get(name) ?? '').trim(); if (!value) throw new Error(`Missing --${name}`); return value; };
const optional = (name, fallback = '') => String(args.get(name) ?? fallback).trim();
const list = (name, separator = ',') => optional(name).split(separator).map((v) => v.trim()).filter(Boolean);
const now = () => new Date().toISOString();
const sha = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const ensure = () => { fs.mkdirSync(COORD_DIR, { recursive: true }); fs.mkdirSync(PACKET_DIR, { recursive: true }); fs.mkdirSync(HANDOFF_DIR, { recursive: true }); };
const readJson = (file, fallback) => fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : fallback;
const writeJson = (file, value) => fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
const storageKey = (value) => createHash('sha256').update(value).digest('hex');
const visibilityPath = (sessionId) => path.join(VISIBILITY_DIR, `${storageKey(sessionId)}.json`);
const packetPath = (taskId) => path.join(PACKET_DIR, `${storageKey(taskId)}.json`);
const readVisibility = (sessionId) => { const file = visibilityPath(sessionId); if (!fs.existsSync(file)) throw new Error(`AGENT_VISIBILITY_RECORD_MISSING=${sessionId}`); return JSON.parse(fs.readFileSync(file, 'utf8')); };
const assertOpenVisibility = (task, sessionId, agentId) => { const record = readVisibility(sessionId); if (record.visibilityState !== 'OPEN' || record.status !== 'RUNNING') throw new Error(`AGENT_VISIBILITY_NOT_OPEN=${sessionId}`); if (record.taskId !== task.taskId) throw new Error('AGENT_VISIBILITY_TASK_MISMATCH'); if (record.agentId !== agentId) throw new Error('AGENT_VISIBILITY_AGENT_MISMATCH'); return record; };
const visibleAgents = () => { if (!fs.existsSync(VISIBILITY_DIR)) return []; return fs.readdirSync(VISIBILITY_DIR).filter((entry) => entry.endsWith('.json')).sort().map((entry) => { try { const item = JSON.parse(fs.readFileSync(path.join(VISIBILITY_DIR, entry), 'utf8')); return { taskId: item.taskId ?? null, sessionId: item.sessionId ?? entry.slice(0,-5), agentId: item.agentId ?? null, role: item.role ?? null, status: item.status ?? null, finalStatus: item.finalStatus ?? null, entrySha: item.entrySha ?? null, exitSha: item.exitSha ?? null, finalSummary: item.finalSummary ?? null, remainingWork: item.remainingWork ?? [], openRcas: item.openRcas ?? [], updatedAt: item.updatedAt ?? null }; } catch { return { sessionId: entry.slice(0,-5), status: 'MALFORMED_EVIDENCE' }; } }); };
const state = readJson(QUEUE_FILE, { schemaVersion: 1, authority: 'AGENT_COORDINATION_CONTROL_PLANE', authoritativeSha: sha(), updatedAt: now(), tasks: {}, activeSessions: {} });
const locks = readJson(LOCK_FILE, { schemaVersion: 1, authority: 'AGENT_SCOPE_LOCKS', locks: {} });
function save() { state.authoritativeSha = sha(); state.updatedAt = now(); writeJson(QUEUE_FILE, state); writeJson(LOCK_FILE, locks); }
function overlap(a, b) { return a.some((x) => b.has(x)); }
function lock(sessionId, agentId, rca, scope) {
  for (const [id, item] of Object.entries(locks.locks)) {
    if (item.status !== 'ACTIVE' || item.sessionId === sessionId) continue;
    if ((rca && item.rca && rca === item.rca) || overlap(scope, new Set(item.scope ?? []))) throw new Error(`COORDINATION_CONFLICT=${id}`);
  }
  const lockId = `${sessionId}:${sha()}`;
  locks.locks[lockId] = { lockId, sessionId, agentId, rca: rca || null, scope, entrySha: sha(), acquiredAt: now(), status: 'ACTIVE' };
  return lockId;
}
function unlock(sessionId) { for (const item of Object.values(locks.locks)) if (item.sessionId === sessionId && item.status === 'ACTIVE') { item.status = 'RELEASED'; item.releasedAt = now(); } }
ensure();
if (!['task-create', 'task-claim', 'task-release', 'task-complete', 'state', 'visible', 'ingest-handoff'].includes(command)) throw new Error('Usage: agent-coordination.mjs task-create|task-claim|task-release|task-complete|state|visible|ingest-handoff');

if (command === 'task-create') {
  const taskId = requireArg('task');
  if (state.tasks[taskId]) throw new Error(`Task already exists: ${taskId}`);
  const task = { taskId, title: requireArg('title'), priority: Number(optional('priority', '50')), lane: optional('lane', 'fast-path'), rca: optional('rca') || null, scope: list('scope'), objective: optional('objective'), knownFailure: optional('known-failure'), evidenceRequired: list('evidence-required'), dependsOn: list('depends-on'), status: 'READY', createdAt: now() };
  for (const dep of task.dependsOn) if (!state.tasks[dep]) throw new Error(`Unknown dependency: ${dep}`);
  state.tasks[taskId] = task;
  writeJson(packetPath(taskId), { schemaVersion: 1, ...task, entrySha: sha(), createdAt: now(), nextActions: [], continuation: null });
  save();
  console.log(JSON.stringify(task, null, 2));
}

if (command === 'task-claim') {
  const taskId = requireArg('task'); const sessionId = requireArg('session'); const agentId = requireArg('agent');
  const task = state.tasks[taskId]; if (!task) throw new Error(`Unknown task: ${taskId}`); if (!['READY', 'QUEUED'].includes(task.status)) throw new Error(`Task not claimable: ${task.status}`);
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
  if (inboundMessage) {
    try {
      inboundMessage = consumeAgentMessage(inboundMessage.messageId, agentId, sha(), true);
    } catch (error) {
      unlock(sessionId);
      throw error;
    }
  }
  task.status = 'RUNNING'; task.claimedBy = agentId; task.sessionId = sessionId; task.claimedAt = now(); task.entrySha = sha(); task.lockId = lockId;
  state.activeSessions[sessionId] = { sessionId, agentId, taskId, lockId, entrySha: sha(), ...(inboundMessage ? { messageId: inboundMessage.messageId, messageEntrySha: inboundMessage.entrySha } : {}), updatedAt: now() };
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
  task.status = 'DONE'; task.completedAt = now(); task.exitSha = sha(); task.evidence = list('evidence'); task.findings = list('findings'); task.finalStatus = visibility.finalStatus; task.finalSummary = visibility.finalSummary; task.visibilityPath = path.relative(ROOT, visibilityPath(sessionId)); unlock(sessionId); delete state.activeSessions[sessionId]; save(); console.log(JSON.stringify(task, null, 2));
}

if (command === 'ingest-handoff') {
  const previous = requireArg('from-session'); const file = path.join(HANDOFF_DIR, `${storageKey(previous)}.json`); if (!fs.existsSync(file)) throw new Error(`HANDOFF_NOT_FOUND=${previous}`);
  const report = JSON.parse(fs.readFileSync(file, 'utf8')); if (!['VERIFIED', 'BLOCKED'].includes(report.status)) throw new Error('PREDECESSOR_NOT_CLOSED');
  const sessionId = requireArg('session'); const agentId = requireArg('agent'); state.activeSessions[sessionId] = { sessionId, agentId, continuationFrom: previous, inheritedExitSha: report.exitSha ?? null, inheritedRemainingWork: report.remainingWork ?? [], inheritedOpenRcas: report.openRcas ?? [], inheritedNextPlan: report.executionPlanNext ?? [], updatedAt: now() }; save(); console.log(JSON.stringify(state.activeSessions[sessionId], null, 2));
}
if (command === 'visible') { console.log(JSON.stringify(visibleAgents(), null, 2)); }
if (command === 'state') { save(); console.log(JSON.stringify({ ...state, visibleAgents: visibleAgents() }, null, 2)); }
