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

const taskId = 'atomic-race-task';
const scope = ['scripts/ci/agent-coordination.mjs'];
const state = { schemaVersion: 1, authority: 'AGENT_COORDINATION_CONTROL_PLANE', authoritativeSha: currentSha, revision: 0, transactionId: null, updatedAt: new Date().toISOString(), tasks: { [taskId]: { taskId, title: 'Atomic coordination race regression', priority: 100, lane: 'test', rca: 'coordination-race', scope, objective: 'exactly one concurrent claimant may own a task', knownFailure: 'lost update', evidenceRequired: ['single-winner'], dependsOn: [], status: 'READY', createdAt: new Date().toISOString() } }, activeSessions: {} };
const locks = { schemaVersion: 1, authority: 'AGENT_SCOPE_LOCKS', revision: 0, transactionId: null, locks: {} };
fs.writeFileSync(path.join(coordDir, 'coordination-state.json'), JSON.stringify(state, null, 2) + '\n');
fs.writeFileSync(path.join(coordDir, 'coordination-locks.json'), JSON.stringify(locks, null, 2) + '\n');

const visibilityKey = (id) => crypto.createHash('sha256').update(id).digest('hex');
for (const [sessionId, agentId] of [['race-session-a','executionAgent-a'], ['race-session-b','executionAgent-b']]) {
  fs.writeFileSync(path.join(visibilityDir, visibilityKey(sessionId) + '.json'), JSON.stringify({ schemaVersion: 1, authority: 'AGENT_VISIBILITY_LEDGER', visibilityState: 'OPEN', taskId, sessionId, agentId, role: 'executionAgent', entrySha: currentSha, exitSha: null, status: 'RUNNING', finalStatus: null, finalSummary: null, updatedAt: new Date().toISOString() }, null, 2) + '\n');
}

const run = (sessionId, agentId) => new Promise((resolve) => {
  const child = spawn(process.execPath, ['scripts/ci/agent-coordination.mjs', 'task-claim', `--task=${taskId}`, `--session=${sessionId}`, `--agent=${agentId}`], { cwd: root, env: { ...process.env, FLIXO_COORDINATION_DIR: coordDir, FLIXO_AGENT_VISIBILITY_DIR: visibilityDir }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('close', (code) => resolve({ code, stdout, stderr }));
});

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
  console.log('AGENT_COORDINATION_ATOMIC_TEST=PASS');
  console.log('COORDINATION_SINGLE_WINNER=PASS');
  console.log('COORDINATION_REVISION=PASS');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}