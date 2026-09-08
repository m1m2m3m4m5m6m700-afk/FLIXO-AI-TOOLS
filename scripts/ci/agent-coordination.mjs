#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();
const DIR = path.resolve(ROOT, 'diagnostics/agents');
const STATE = path.join(DIR, 'coordination-state.json');
const LOCKS = path.join(DIR, 'coordination-locks.json');
const PACKETS = path.join(DIR, 'task-packets');
const HANDOFFS = path.join(DIR, 'handoffs');
const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) { const t = process.argv[i]; if (!t.startsWith('--')) continue; const e = t.indexOf('='); args.set(t.slice(2, e >= 0 ? e : undefined), e >= 0 ? t.slice(e + 1) : process.argv[i + 1] ?? ''); }
const cmd = String(process.argv[2] ?? '').toLowerCase();
const req = (k) => { const v = String(args.get(k) ?? '').trim(); if (!v) throw new Error(`Missing --${k}`); return v; };
const opt = (k, d = '') => String(args.get(k) ?? d).trim();
const csv = (k) => opt(k).split(',').map((v) => v.trim()).filter(Boolean);
const now = () => new Date().toISOString();
const gitSha = () => execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const readJson = (f, d) => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d;
const writeJson = (f, v) => fs.writeFileSync(f, `${JSON.stringify(v, null, 2)}\n`);
fs.mkdirSync(PACKETS, { recursive: true }); fs.mkdirSync(HANDOFFS, { recursive: true });
const state = readJson(STATE, { schemaVersion: 1, authority: 'AGENT_COORDINATION_CONTROL_PLANE', authoritativeSha: gitSha(), updatedAt: now(), tasks: {}, activeSessions: {} });
const locks = readJson(LOCKS, { schemaVersion: 1, authority: 'AGENT_SCOPE_LOCKS', locks: {} });
function save() { state.authoritativeSha = gitSha(); state.updatedAt = now(); writeJson(STATE, state); writeJson(LOCKS, locks); }
function acquire(sessionId, agentId, rca, scope) { for (const [id, l] of Object.entries(locks.locks)) { if (l.status !== 'ACTIVE' || l.sessionId === sessionId) continue; const sameRca = rca && l.rca && rca === l.rca; const sameScope = (scope ?? []).some((x) => (l.scope ?? []).includes(x)); if (sameRca || sameScope) throw new Error(`COORDINATION_CONFLICT=${id}`); } const id = `${sessionId}:${gitSha()}`; locks.locks[id] = { lockId: id, sessionId, agentId, rca: rca || null, scope, entrySha: gitSha(), acquiredAt: now(), status: 'ACTIVE' }; return id; }
function release(sessionId) { for (const l of Object.values(locks.locks)) if (l.sessionId === sessionId && l.status === 'ACTIVE') { l.status = 'RELEASED'; l.releasedAt = now(); } }
if (!['task-create','task-claim','task-release','task-complete','ingest-handoff','state'].includes(cmd)) throw new Error('Usage: agent-coordination.mjs task-create|task-claim|task-release|task-complete|ingest-handoff|state');
if (cmd === 'task-create') { const taskId = req('task'); if (state.tasks[taskId]) throw new Error(`Task already exists: ${taskId}`); const task = { taskId, title: req('title'), priority: Number(opt('priority','50')), lane: opt('lane','fast-path'), rca: opt('rca') || null, scope: csv('scope'), objective: opt('objective'), knownFailure: opt('known-failure'), evidenceRequired: csv('evidence-required'), dependsOn: csv('depends-on'), status: 'READY', createdAt: now() }; for (const d of task.dependsOn) if (!state.tasks[d]) throw new Error(`Unknown dependency: ${d}`); state.tasks[taskId] = task; writeJson(path.join(PACKETS, `${taskId}.json`), { schemaVersion: 1, ...task, entrySha: gitSha(), createdAt: now(), nextActions: [] }); save(); console.log(JSON.stringify(task, null, 2)); }
if (cmd === 'task-claim') { const taskId=req('task'), sessionId=req('session'), agentId=req('agent'); const task=state.tasks[taskId]; if(!task) throw new Error(`Unknown task: ${taskId}`); if(!['READY','QUEUED'].includes(task.status)) throw new Error(`Task not claimable: ${task.status}`); for(const d of task.dependsOn??[]) if(state.tasks[d]?.status!=='DONE') throw new Error(`DEPENDENCY_BLOCK=${d}`); const lockId=acquire(sessionId,agentId,task.rca,task.scope); Object.assign(task,{status:'RUNNING',claimedBy:agentId,sessionId,claimedAt:now(),entrySha:gitSha(),lockId}); state.activeSessions[sessionId]={sessionId,agentId,taskId,lockId,entrySha:gitSha(),updatedAt:now()}; const p=path.join(PACKETS,`${taskId}.json`); const packet=readJson(p,task); packet.claim={sessionId,agentId,lockId,claimedAt:now(),entrySha:gitSha()}; writeJson(p,packet); save(); console.log(JSON.stringify(task,null,2)); }
if (cmd === 'task-release') { const taskId=req('task'), sessionId=req('session'); const task=state.tasks[taskId]; if(!task) throw new Error(`Unknown task: ${taskId}`); if(task.sessionId!==sessionId) throw new Error('TASK_OWNER_MISMATCH'); Object.assign(task,{status:opt('status','READY').toUpperCase(),releasedAt:now(),remainingWork:csv('remaining-work'),openRcas:csv('open-rcas')}); release(sessionId); delete state.activeSessions[sessionId]; save(); console.log(JSON.stringify(task,null,2)); }
if (cmd === 'task-complete') { const taskId=req('task'), sessionId=req('session'); const task=state.tasks[taskId]; if(!task) throw new Error(`Unknown task: ${taskId}`); if(task.sessionId!==sessionId) throw new Error('TASK_OWNER_MISMATCH'); const openRcas=csv('open-rcas'), remainingWork=csv('remaining-work'); if(openRcas.length||remainingWork.length) throw new Error('TASK_COMPLETION_BLOCKED_BY_UNRESOLVED_WORK'); Object.assign(task,{status:'DONE',completedAt:now(),exitSha:gitSha(),evidence:csv('evidence'),findings:csv('findings')}); release(sessionId); delete state.activeSessions[sessionId]; save(); console.log(JSON.stringify(task,null,2)); }
if (cmd === 'ingest-handoff') { const previous=req('from-session'), sessionId=req('session'), agentId=req('agent'); const f=path.join(HANDOFFS,`${previous}.json`); if(!fs.existsSync(f)) throw new Error(`HANDOFF_NOT_FOUND=${previous}`); const r=JSON.parse(fs.readFileSync(f,'utf8')); if(!['VERIFIED','BLOCKED'].includes(r.status)) throw new Error('PREDECESSOR_NOT_CLOSED'); state.activeSessions[sessionId]={sessionId,agentId,continuationFrom:previous,inheritedExitSha:r.exitSha??null,inheritedRemainingWork:r.remainingWork??[],inheritedOpenRcas:r.openRcas??[],inheritedNextPlan:r.executionPlanNext??[],updatedAt:now()}; save(); console.log(JSON.stringify(state.activeSessions[sessionId],null,2)); }
if (cmd === 'state') { save(); console.log(JSON.stringify(state,null,2)); }
