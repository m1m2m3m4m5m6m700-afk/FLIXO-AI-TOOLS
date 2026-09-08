#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const COORD_DIR = path.resolve(ROOT, 'diagnostics/agents');
const QUEUE_FILE = path.join(COORD_DIR, 'coordination-state.json');
const LOCK_FILE = path.join(COORD_DIR, 'coordination-locks.json');
const PACKET_DIR = path.join(COORD_DIR, 'task-packets');
const HANDOFF_DIR = path.join(COORD_DIR, 'handoffs');
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
if (!['task-create', 'task-claim', 'task-release', 'task-complete', 'state', 'ingest-handoff'].includes(command)) throw new Error('Usage: agent-coordination.mjs task-create|task-claim|task-release|task-complete|state|ingest-handoff');

if (command === 'task-create') {
  const taskId = requireArg('task');
  if (state.tasks[taskId]) throw new Error(`Task already exists: ${taskId}`);
  const task = { taskId, title: requireArg('title'), priority: Number(optional('priority', '50')), lane: optional('lane', 'fast-path'), rca: optional('rca') || null, scope: list('scope'), objective: optional('objective'), knownFailure: optional('known-failure'), evidenceRequired: list('evidence-required'), dependsOn: list('depends-on'), status: 'READY', createdAt: now() };
  for (const dep of task.dependsOn) if (!state.tasks[dep]) throw new Error(`Unknown dependency: ${dep}`);
  state.tasks[taskId] = task;
  writeJson(path.join(PACKET_DIR, `${taskId}.json`), { schemaVersion: 1, ...task, entrySha: sha(), createdAt: now(), nextActions: [], continuation: null });
  save();
  console.log(JSON.stringify(task, null, 2));
}

if (command === 'task-claim') {
  const taskId = requireArg('task'); const sessionId = requireArg('session'); const agentId = requireArg('agent');
  const task = state.tasks[taskId]; if (!task) throw new Error(`Unknown task: ${taskId}`); if (!['READY', 'QUEUED'].includes(task.status)) throw new Error(`Task not claimable: ${task.status}`);
  for (const dep of task.dependsOn ?? []) if (state.tasks[dep]?.status !== 'DONE') throw new Error(`DEPENDENCY_BLOCK=${dep}`);
  const lockId = lock(sessionId, agentId, task.rca, task.scope); task.status = 'RUNNING'; task.claimedBy = agentId; task.sessionId = sessionId; task.claimedAt = now(); task.entrySha = sha(); task.lockId = lockId;
  state.activeSessions[sessionId] = { sessionId, agentId, taskId, lockId, entrySha: sha(), updatedAt: now() };
  const packetFile = path.join(PACKET_DIR, `${taskId}.json`); const packet = readJson(packetFile, task); packet.claim = { sessionId, agentId, lockId, claimedAt: now(), entrySha: sha() }; writeJson(packetFile, packet); save(); console.log(JSON.stringify(task, null, 2));
}

if (command === 'task-release') {
  const taskId = requireArg('task'); const sessionId = requireArg('session'); const task = state.tasks[taskId]; if (!task) throw new Error(`Unknown task: ${taskId}`); if (task.sessionId !== sessionId) throw new Error('TASK_OWNER_MISMATCH');
  task.status = optional('status', 'READY').toUpperCase(); task.releasedAt = now(); task.remainingWork = list('remaining-work'); task.openRcas = list('open-rcas'); unlock(sessionId); delete state.activeSessions[sessionId]; save(); console.log(JSON.stringify(task, null, 2));
}

if (command === 'task-complete') {
  const taskId = requireArg('task'); const sessionId = requireArg('session'); const task = state.tasks[taskId]; if (!task) throw new Error(`Unknown task: ${taskId}`); if (task.sessionId !== sessionId) throw new Error('TASK_OWNER_MISMATCH');
  const openRcas = list('open-rcas'); const remainingWork = list('remaining-work'); if (openRcas.length || remainingWork.length) throw new Error('TASK_COMPLETION_BLOCKED_BY_UNRESOLVED_WORK');
  task.status = 'DONE'; task.completedAt = now(); task.exitSha = sha(); task.evidence = list('evidence'); task.findings = list('findings'); unlock(sessionId); delete state.activeSessions[sessionId]; save(); console.log(JSON.stringify(task, null, 2));
}

if (command === 'ingest-handoff') {
  const previous = requireArg('from-session'); const file = path.join(HANDOFF_DIR, `${previous}.json`); if (!fs.existsSync(file)) throw new Error(`HANDOFF_NOT_FOUND=${previous}`);
  const report = JSON.parse(fs.readFileSync(file, 'utf8')); if (!['VERIFIED', 'BLOCKED'].includes(report.status)) throw new Error('PREDECESSOR_NOT_CLOSED');
  const sessionId = requireArg('session'); const agentId = requireArg('agent'); state.activeSessions[sessionId] = { sessionId, agentId, continuationFrom: previous, inheritedExitSha: report.exitSha ?? null, inheritedRemainingWork: report.remainingWork ?? [], inheritedOpenRcas: report.openRcas ?? [], inheritedNextPlan: report.executionPlanNext ?? [], updatedAt: now() }; save(); console.log(JSON.stringify(state.activeSessions[sessionId], null, 2));
}
if (command === 'state') { save(); console.log(JSON.stringify(state, null, 2)); }
