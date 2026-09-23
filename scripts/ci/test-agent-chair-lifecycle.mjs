#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const ROOT = process.cwd();
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'flixo-agent-chair-lifecycle-'));
const env = {
  ...process.env,
  FLIXO_AGENT_SESSION_DIR: path.join(temp, 'sessions'),
  FLIXO_AGENT_VISIBILITY_DIR: path.join(temp, 'ledger'),
  FLIXO_COORDINATION_DIR: path.join(temp, 'coordination'),
  FLIXO_CHAIR_STATE_PATH: path.join(temp, 'locks', 'chairs.json'),
  FLIXO_CHAIR_SIGNING_KEY: 'test-agent-chair-signing-key',
  NODE_ENV: 'test',
  FLIXO_CHAIR_TEST_LOCAL_AUTH: 'true',
  FLIXO_CHAIR_REF_PREFIX: 'refs/flixo/tests/agent-chair-' + process.pid,
};
const session = 'agent-chair-smoke-' + process.pid;
const agent = 'agent-chair-smoke';
const task = 'TASK-CHAIR-SMOKE';
const sha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const run = (args) => execFileSync(process.execPath, ['scripts/ci/agent-session.mjs', ...args], { cwd: ROOT, env: { ...env, FLIXO_AGENT_SESSION: session, FLIXO_AGENT_ID: agent, FLIXO_AGENT_TASK: task }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });

run(['login', '--session=' + session, '--agent=' + agent, '--task=' + task, '--role=executionAgent', '--scope=src/', '--bootstrap=true']);
run(['event', '--session=' + session, '--agent=' + agent, '--task=' + task, '--type=PROGRESS', '--summary=chair lifecycle smoke test']);

const sessionFile = path.join(env.FLIXO_AGENT_SESSION_DIR, createHash('sha256').update(session).digest('hex') + '.json');
const record = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
assert.equal(record.chairBinding.chairId, 'chair_1');
assert.equal(record.chairBinding.released, false);

const recordedEvent = record.activity.find((item) => item.action === 'EVENT' && item.type === 'PROGRESS');
assert.ok(recordedEvent);
assert.equal(recordedEvent.workEvent, true);
assert.equal(recordedEvent.workRecorded, true);
assert.equal(recordedEvent.chairId, 'chair_1');
assert.equal(recordedEvent.chairLeaseId, record.chairBinding.leaseId);
assert.equal(recordedEvent.exactSha, sha);

const chairState = JSON.parse(fs.readFileSync(env.FLIXO_CHAIR_STATE_PATH, 'utf8'));
assert.equal(chairState.chairs.chair_1.status, 'OCCUPIED');
assert.equal(chairState.chairs.chair_1.holder_agent_id, agent);
assert.equal(chairState.chairs.chair_1.target_sha, sha);

console.log('AGENT_CHAIR_AUTO_ADMISSION=PASS');
console.log('AGENT_WORK_EVENT_RECORDED_WITH_CHAIR=PASS');
console.log('AGENT_CHAIR_EXACT_SHA=PASS');
