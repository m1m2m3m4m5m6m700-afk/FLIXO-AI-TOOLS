#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const root = process.cwd();
const currentSha = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-agent-coordination-'));
const coordDir = path.join(temp, 'coord');
const visibilityDir = path.join(temp, 'visibility');
fs.mkdirSync(path.join(coordDir, 'task-packets'), { recursive: true });
fs.mkdirSync(path.join(coordDir, 'handoffs'), { recursive: true });
fs.mkdirSync(visibilityDir, { recursive: true });
const chairStatePath = path.join(temp, 'chair-state.json');
const ledgerFile = path.join(temp, 'المهام.md');
fs.writeFileSync(ledgerFile, ['# TEST TASK LEDGER', '## 1) P0 — DONE-001', 'STATUS = CLOSED / VERIFIED', '## 2) P1 — NEXT-001', 'STATUS = OPEN', '## 3) P1 — BLOCKED-001', 'STATUS = OPEN / BLOCKED', '## 4) P1 — LATE-001', 'STATUS = READY'].join('\n') + '\n');

const taskId = 'atomic-race-task';
const scope = ['scripts/ci/agent-coordination.mjs'];
const state = { schemaVersion: 1, authority: 'AGENT_COORDINATION_CONTROL_PLANE', authoritativeSha: currentSha, revision: 0, transactionId: null, updatedAt: new Date().toISOString(), tasks: { [taskId]: { taskId, title: 'Atomic coordination race regression', priority: 100, lane: 'test', rca: 'coordination-race', scope, objective: 'exactly one concurrent claimant may own a task', knownFailure: 'lost update', evidenceRequired: ['single-winner'], dependsOn: [], missionId: 'MISSION:COORDINATION-RACE', workPackageId: taskId, ownerRole: 'verification', ownerAgent: null, workItems: ['single-owner claim'], acceptanceCriteria: ['exactly one winner'], proofObligations: ['race regression'], status: 'READY', createdAt: new Date().toISOString() } }, activeSessions: {} };
const locks = { schemaVersion: 1, authority: 'AGENT_SCOPE_LOCKS', revision: 0, transactionId: null, locks: {} };
fs.writeFileSync(path.join(coordDir, 'coordination-state.json'), JSON.stringify(state, null, 2) + '\n');
fs.writeFileSync(path.join(coordDir, 'coordination-locks.json'), JSON.stringify(locks, null, 2) + '\n');

const visibilityKey = (id) => crypto.createHash('sha256').update(id).digest('hex');
for (const [sessionId, agentId] of [['race-session-a','executionAgent-a'], ['race-session-b','executionAgent-b']]) {
  fs.writeFileSync(path.join(visibilityDir, visibilityKey(sessionId) + '.json'), JSON.stringify({ schemaVersion: 1, authority: 'AGENT_VISIBILITY_LEDGER', visibilityState: 'OPEN', taskId, sessionId, agentId, role: 'verification', scope, entrySha: currentSha, exitSha: null, status: 'RUNNING', finalStatus: null, finalSummary: null, updatedAt: new Date().toISOString() }, null, 2) + '\n');
}

const runArgs = (args) => new Promise((resolve) => {
  const child = spawn(process.execPath, ['scripts/ci/agent-coordination.mjs', ...args], { cwd: root, env: { ...process.env, NODE_ENV: 'test', FLIXO_CHAIR_TEST_LOCAL_AUTH: 'true', FLIXO_CHAIR_SIGNING_KEY: 'test-chair-signing-key', FLIXO_CHAIR_STATE_PATH: chairStatePath, FLIXO_COORDINATION_DIR: coordDir, FLIXO_AGENT_VISIBILITY_DIR: visibilityDir, FLIXO_TASK_LEDGER_FILE: ledgerFile }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('close', (code) => resolve({ code, stdout, stderr }));
});
const run = (sessionId, agentId) => runArgs(['task-claim', '--chair=chair_2', `--task=${taskId}`, `--session=${sessionId}`, `--agent=${agentId}`]);

try {
  const results = await Promise.all([run('race-session-a', 'executionAgent-a'), run('race-session-b', 'executionAgent-b')]);
  const winners = results.filter((result) => result.code === 0);
  assert.equal(winners.length, 1, `expected exactly one winner; results=${JSON.stringify(results)}`);
  const finalState = JSON.parse(fs.readFileSync(path.join(coordDir, 'coordination-state.json'), 'utf8'));
  const finalLocks = JSON.parse(fs.readFileSync(path.join(coordDir, 'coordination-locks.json'), 'utf8'));
  assert.equal(finalState.tasks[taskId].status, 'RUNNING');
  assert.ok(['executionAgent-a','executionAgent-b'].includes(finalState.tasks[taskId].claimedBy));
  assert.equal(Object.keys(finalState.activeSessions).length, 1);
  assert.equal(finalState.revision, 1);
  assert.equal(finalLocks.revision, 1);
  assert.equal(finalState.transactionId, finalLocks.transactionId);
  const revisionBeforeRead = finalState.revision;
  const readLockDir = path.join(coordDir, '.coordination-write.lock');
  fs.mkdirSync(readLockDir, { recursive: true });
  fs.writeFileSync(path.join(readLockDir, 'owner.json'), JSON.stringify({ pid: process.pid, hostname: os.hostname(), createdAtMs: Date.now() }) + '\n');
  const briefResult = await runArgs(['brief']);
  assert.equal(briefResult.code, 0, `lock-free brief read failed: ${JSON.stringify(briefResult)}`);
  const brief = JSON.parse(briefResult.stdout);
  assert.equal(brief.authority, 'AGENT_COORDINATION_FAST_READ_PATH');
  assert.equal(brief.readOnly, true);
  assert.equal(brief.readSha, currentSha);
  assert.equal(brief.revision, revisionBeforeRead);
  const stateResult = await runArgs(['state']);
  assert.equal(stateResult.code, 0, `lock-free state read failed: ${JSON.stringify(stateResult)}`);
  const readState = JSON.parse(stateResult.stdout);
  assert.equal(readState.readSha, currentSha);
  assert.equal(readState.revision, revisionBeforeRead);
  const afterReadState = JSON.parse(fs.readFileSync(path.join(coordDir, 'coordination-state.json'), 'utf8'));
  assert.equal(afterReadState.revision, revisionBeforeRead);
  fs.rmSync(readLockDir, { recursive: true, force: true });
  console.log('COORDINATION_LOCK_FREE_READ=PASS');
  console.log('COORDINATION_BRIEF_SNAPSHOT=PASS');

  const staleSessionId = 'stale-session';
  const staleTaskId = 'stale-task';
  const staleSha = '0'.repeat(40);
  const staleLockId = 'stale-lock';
  finalState.tasks[staleTaskId] = { taskId: staleTaskId, title: 'Stale kill-switch regression', status: 'RUNNING', sessionId: staleSessionId, claimedBy: 'executionAgent-stale', scope: ['stale'], dependsOn: [] };
  finalState.activeSessions[staleSessionId] = { sessionId: staleSessionId, agentId: 'executionAgent-stale', taskId: staleTaskId, lockId: staleLockId, entrySha: staleSha, governanceFingerprint: finalState.governanceFingerprint, updatedAt: new Date().toISOString() };
  finalLocks.locks[staleLockId] = { lockId: staleLockId, sessionId: staleSessionId, agentId: 'executionAgent-stale', scope: ['stale'], entrySha: staleSha, status: 'ACTIVE', acquiredAt: new Date().toISOString() };
  fs.writeFileSync(path.join(coordDir, 'coordination-state.json'), JSON.stringify(finalState, null, 2) + '\n');
  fs.writeFileSync(path.join(coordDir, 'coordination-locks.json'), JSON.stringify(finalLocks, null, 2) + '\n');
  fs.writeFileSync(path.join(visibilityDir, visibilityKey(staleSessionId) + '.json'), JSON.stringify({ schemaVersion: 1, authority: 'AGENT_VISIBILITY_LEDGER', visibilityState: 'OPEN', taskId: staleTaskId, sessionId: staleSessionId, agentId: 'executionAgent-stale', role: 'executionAgent', entrySha: staleSha, status: 'RUNNING', finalStatus: null, finalSummary: null, updatedAt: new Date().toISOString() }, null, 2) + '\n');
  const staleResult = await runArgs(['state']);
  assert.equal(staleResult.code, 0, `stale reconciliation should succeed: ${JSON.stringify(staleResult)}`);
  const reconciledState = JSON.parse(fs.readFileSync(path.join(coordDir, 'coordination-state.json'), 'utf8'));
  const reconciledLocks = JSON.parse(fs.readFileSync(path.join(coordDir, 'coordination-locks.json'), 'utf8'));
  assert.equal(reconciledState.tasks[staleTaskId].status, 'STALE');
  assert.equal(reconciledState.activeSessions[staleSessionId], undefined);
  assert.equal(reconciledState.staleSessions[staleSessionId].staleReason, 'ENTRY_SHA_MISMATCH');
  assert.equal(reconciledLocks.locks[staleLockId].status, 'RELEASED');
  assert.equal(JSON.parse(fs.readFileSync(path.join(visibilityDir, visibilityKey(staleSessionId) + '.json'), 'utf8')).status, 'STALE');
  console.log('STALE_SESSION_KILL_SWITCH=PASS');

  const handoffSessionId = 'handoff-next';
  const predecessor = 'handoff-prev';
  const handoffFile = path.join(coordDir, 'handoffs', visibilityKey(predecessor) + '.json');
  fs.writeFileSync(handoffFile, JSON.stringify({ schemaVersion: 1, reportId: `${predecessor}:${currentSha}`, sessionId: predecessor, agentId: 'executionAgent-prev', role: 'executionAgent', taskId: 'handoff-task', status: 'VERIFIED', scope: ['handoff-scope'], exitSha: currentSha, remainingWork: [], openRcas: [], executionPlanNext: [] }, null, 2) + '\n');
  const admittedHandoff = await runArgs(['ingest-handoff', `--from-session=${predecessor}`, `--session=${handoffSessionId}`, '--agent=executionAgent-next', '--role=executionAgent', '--task=handoff-task', '--scope=handoff-scope']);
  assert.equal(admittedHandoff.code, 0, `fresh handoff must be admitted: ${JSON.stringify(admittedHandoff)}`);
  const postHandoffState = JSON.parse(fs.readFileSync(path.join(coordDir, 'coordination-state.json'), 'utf8'));
  assert.equal(postHandoffState.activeSessions[handoffSessionId].entrySha, currentSha);
  assert.equal(postHandoffState.activeSessions[handoffSessionId].inheritedExitSha, currentSha);
  assert.equal(postHandoffState.activeSessions[handoffSessionId].role, 'executionAgent');
  console.log('HANDOFF_ADMISSION_PARITY=PASS');

  const stalePredecessor = 'handoff-prev-stale';
  fs.writeFileSync(path.join(coordDir, 'handoffs', visibilityKey(stalePredecessor) + '.json'), JSON.stringify({ schemaVersion: 1, reportId: `${stalePredecessor}:${staleSha}`, sessionId: stalePredecessor, agentId: 'executionAgent-prev', role: 'executionAgent', taskId: 'handoff-task', status: 'VERIFIED', scope: ['handoff-scope'], exitSha: staleSha, remainingWork: [], openRcas: [], executionPlanNext: [] }, null, 2) + '\n');
  const rejectedHandoff = await runArgs(['ingest-handoff', `--from-session=${stalePredecessor}`, '--session=handoff-rejected', '--agent=executionAgent-next', '--role=executionAgent', '--task=handoff-task', '--scope=handoff-scope']);
  assert.notEqual(rejectedHandoff.code, 0);
  assert.match(rejectedHandoff.stderr, /HANDOFF_STALE_EXIT_SHA/);
  console.log('HANDOFF_STALE_FAIL_CLOSED=PASS');


  const nextLedger = await runArgs(['task-next', '--agent=executionAgent-next', '--completed-task=old-task']);
  assert.equal(nextLedger.code, 0, `ledger task dispatch failed: ${JSON.stringify(nextLedger)}`);
  const nextPayload = JSON.parse(nextLedger.stdout);
  assert.equal(nextPayload.sourceOfTruth, 'المهام.md');
  assert.equal(nextPayload.nextTask.taskId, 'NEXT-001');
  assert.equal(nextPayload.nextTask.ledgerStatus, 'OPEN');
  assert.equal(nextPayload.dispatch.recipient, 'executionAgent-next');
  const nextState = JSON.parse(fs.readFileSync(path.join(coordDir, 'coordination-state.json'), 'utf8'));
  assert.equal(nextState.nextDispatch.nextTaskId, 'NEXT-001');
  assert.equal(nextState.tasks['NEXT-001'].sourceOfTruth, 'المهام.md');
  console.log('TASK_LEDGER_COUNCIL_BINDING=PASS');
  console.log('COUNCIL_NEXT_TASK_DISPATCH=PASS');

  console.log('AGENT_COORDINATION_ATOMIC_TEST=PASS');
  console.log('COORDINATION_SINGLE_WINNER=PASS');
  console.log('COORDINATION_REVISION=PASS');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}