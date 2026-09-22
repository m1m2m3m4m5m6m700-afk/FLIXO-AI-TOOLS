#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  buildConfig,
  pollDispatch,
  executeExternalAgent,
  createBridge,
  createWakeServer,
  exactSha,
} from './council/external-gpt-bridge.mjs';

const SHA = 'a'.repeat(40);
const calls = [];
const agentResult = () => ({
  profileId: 'ACTION_FRONTIER_REPAIR_V2',
  exactSha: SHA,
  objective: 'test bridge',
  requiredCapabilities: ['RCA'],
  planSummary: 'bounded plan',
  decision: 'REVIEW',
  verification: 'test verification',
  selfCritique: 'test self-check',
  alternativesConsidered: ['alternative'],
  verificationPassed: true,
  finding: ['test finding'],
  evidence: ['test evidence'],
  evidenceGrade: 'E4',
  unknowns: [],
  lesson: 'test lesson',
  antiLesson: 'test antiLesson',
  skillCandidate: 'test-skill',
  directBenefit: 'test benefit',
  nextAction: 'continue',
  decisionTrace: 'test trace',
  reviewRequired: true,
  selfApproved: false,
  uncertaintyAcknowledged: true,
  hypotheses: ['h1', 'h2'],
  selectedHypothesis: 'h1',
  counterexamples: ['c1'],
  toolTrace: ['diagnostics'],
  memoryReferences: ['error-memory:F001'],
  simulationSummary: 'simulation pass',
  simulationPassed: true,
  uncertaintySummary: 'bounded uncertainty'
});

let pollCount = 0;
let sessionFromAck = null;
const completeCalls = [];

const mockFetch = async (url, init = {}) => {
  const u = new URL(url);
  const body = init.body ? JSON.parse(init.body) : null;
  const action = u.searchParams.get('action');
  calls.push({ path: u.pathname, action, method: init.method ?? 'GET', body });

  if (u.hostname === 'runtime.test') {
    if (action === 'poll') {
      pollCount += 1;
      if (pollCount === 1) return new Response(JSON.stringify({
        ok: true, identityVerified: true,
        identity: { agentId: 'flixo-worker-a-001', machineRole: 'executionAgent' },
        dispatch: {
          dispatch_id: 'dispatch-001', status: 'LEASED', mission_id: 'MISSION-001',
          task_id: 'GREEN-RECOVERY-001', work_package_id: 'ROOT-CAUSE-SPINE-001',
          entry_sha: SHA, payload: { reason: 'test-wake' }
        }
      }), { status: 200 });
      if (pollCount === 2) return new Response(JSON.stringify({
        ok: true, identityVerified: true,
        identity: { agentId: 'flixo-worker-a-001', machineRole: 'executionAgent' },
        dispatch: {
          dispatch_id: 'dispatch-001', status: 'ACKED', session_id: sessionFromAck,
          mission_id: 'MISSION-001', task_id: 'GREEN-RECOVERY-001',
          work_package_id: 'ROOT-CAUSE-SPINE-001', entry_sha: SHA,
          payload: { reason: 'continuation' }
        }
      }), { status: 200 });
      return new Response(JSON.stringify({ ok: true, dispatch: null }), { status: 200 });
    }
    if (action === 'ack') {
      sessionFromAck = body.sessionId;
      return new Response(JSON.stringify({ ok: true, dispatch: body }), { status: 200 });
    }
    if (action === 'heartbeat') {
      return new Response(JSON.stringify({ ok: true, dispatch: body }), { status: 200 });
    }
    if (action === 'complete') {
      completeCalls.push(body);
      return new Response(JSON.stringify({ ok: true, dispatch: body }), { status: 200 });
    }
  }

  if (u.hostname === 'executor.test') {
    return new Response(JSON.stringify({
      status: pollCount === 1 ? 'CONTINUE' : 'DONE',
      evidence: { executor: 'mock', verified: true },
      payload: { agentResult: agentResult() }
    }), { status: 200 });
  }

  throw new Error('unexpected mock URL: ' + url);
};

const config = buildConfig('WORKER_A', {
  COUNCIL_RUNTIME_URL: 'https://runtime.test/functions/v1/flixo-council-runtime',
  COUNCIL_WORKER_A_TOKEN: 'worker-token',
  COUNCIL_WORKER_A_BRIDGE_PORT: '8782',
  COUNCIL_WORKER_A_AGENT_ENDPOINT: 'https://executor.test/execute',
  COUNCIL_WORKER_A_AGENT_TOKEN: 'executor-token'
});

const bridge = createBridge({ config, fetchImpl: mockFetch, heartbeatMs: 5 });
assert.equal(await bridge.processOnce(), true);
assert.equal(await bridge.processOnce(), true);

const executorCalls = calls.filter((call) => call.path === '/execute');
assert.equal(executorCalls.length, 2);
assert.equal(executorCalls[0].body.sessionId, executorCalls[1].body.sessionId);
assert.equal(calls.filter((call) => call.action === 'ack').length, 1);
assert.equal(completeCalls.length, 1);
assert.equal(completeCalls[0].status, 'DONE');
assert.ok(calls.filter((call) => call.action === 'heartbeat').length >= 2);

const directContinue = await executeExternalAgent(config, {
  dispatch_id: 'dispatch-continue',
  task_id: 'GREEN-RECOVERY-001',
  work_package_id: 'ROOT-CAUSE-SPINE-001',
  mission_id: 'MISSION-001',
  entry_sha: SHA,
  identity: { agentId: 'flixo-worker-a-001', machineRole: 'executionAgent' },
  payload: { reason: 'direct' }
}, executorCalls[0].body.sessionId, async () => new Response(JSON.stringify({
  status: 'CONTINUE',
  evidence: { executor: 'mock' },
  payload: { agentResult: agentResult() }
}), { status: 200 }));
assert.equal(directContinue.status, 'CONTINUE');
assert.equal(directContinue.evidence.actionAgentValidation.terminal, false);

let heartbeatCount = 0;
let failingComplete = 0;
const failingFetch = async (url, init = {}) => {
  const u = new URL(url);
  const body = init.body ? JSON.parse(init.body) : null;
  const action = u.searchParams.get('action');
  if (u.hostname === 'runtime-fail.test') {
    if (action === 'poll') return new Response(JSON.stringify({
      ok: true, identityVerified: true,
      identity: { agentId: 'flixo-worker-a-001', machineRole: 'executionAgent' },
      dispatch: {
        dispatch_id: 'dispatch-fail-001', status: 'LEASED', mission_id: 'MISSION-001',
        task_id: 'GREEN-RECOVERY-001', work_package_id: 'ROOT-CAUSE-SPINE-001',
        entry_sha: SHA, payload: { reason: 'heartbeat-failure' }
      }
    }), { status: 200 });
    if (action === 'ack') return new Response(JSON.stringify({ ok: true, dispatch: body }), { status: 200 });
    if (action === 'heartbeat') {
      heartbeatCount += 1;
      if (heartbeatCount >= 2) return new Response(JSON.stringify({ error: 'HEARTBEAT_DOWN' }), { status: 503 });
      return new Response(JSON.stringify({ ok: true, dispatch: body }), { status: 200 });
    }
    if (action === 'complete') {
      failingComplete += 1;
      return new Response(JSON.stringify({ ok: true, dispatch: body }), { status: 200 });
    }
  }
  if (u.hostname === 'executor-fail.test') {
    await new Promise((resolve) => setTimeout(resolve, 20));
    return new Response(JSON.stringify({
      status: 'DONE', evidence: { executor: 'mock' },
      payload: { agentResult: agentResult() }
    }), { status: 200 });
  }
  throw new Error('unexpected failing mock URL: ' + url);
};

const failingConfig = buildConfig('WORKER_A', {
  COUNCIL_RUNTIME_URL: 'https://runtime-fail.test/functions/v1/flixo-council-runtime',
  COUNCIL_WORKER_A_TOKEN: 'worker-token',
  COUNCIL_WORKER_A_BRIDGE_PORT: '8782',
  COUNCIL_WORKER_A_AGENT_ENDPOINT: 'https://executor-fail.test/execute',
  COUNCIL_WORKER_A_AGENT_TOKEN: 'executor-token'
});
const failingBridge = createBridge({ config: failingConfig, fetchImpl: failingFetch, heartbeatMs: 5 });
await assert.rejects(() => failingBridge.processOnce(), /COUNCIL_BRIDGE_HEARTBEAT_FAILED/);
assert.equal(failingComplete, 0);
assert.ok(heartbeatCount >= 2);
failingBridge.stop();

const wakeServer = createWakeServer({ config, bridge });
await new Promise((resolve) => wakeServer.listen(0, '127.0.0.1', resolve));
const port = wakeServer.address().port;
const unauthorized = await fetch('http://127.0.0.1:' + port + '/wake', {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ accountId: 'WORKER_A', exactSha: SHA })
});
assert.equal(unauthorized.status, 401);
const authorized = await fetch('http://127.0.0.1:' + port + '/wake', {
  method: 'POST',
  headers: { authorization: 'Bearer worker-token', 'content-type': 'application/json' },
  body: JSON.stringify({ accountId: 'WORKER_A', exactSha: SHA, dispatchId: 'dispatch-001' })
});
assert.equal(authorized.status, 202);
const health = await fetch('http://127.0.0.1:' + port + '/health');
assert.equal(health.status, 200);
wakeServer.close();
bridge.stop();

assert.ok(calls.some((call) => call.action === 'poll'));
assert.ok(calls.some((call) => call.action === 'ack'));
assert.ok(calls.some((call) => call.action === 'complete'));
assert.ok(calls.some((call) => call.path === '/execute'));

console.log('COUNCIL_EXTERNAL_GPT_BRIDGE=PASS');
console.log('COUNCIL_EXTERNAL_GPT_BRIDGE_MULTI_CYCLE=PASS');
console.log('COUNCIL_EXTERNAL_GPT_BRIDGE_HEARTBEAT_FAIL_CLOSED=PASS');
console.log('COUNCIL_EXTERNAL_GPT_BRIDGE_WAKE_AUTH=PASS');
console.log('COUNCIL_EXTERNAL_GPT_BRIDGE_EXACT_SHA=PASS');
console.log('COUNCIL_EXTERNAL_GPT_BRIDGE_ACK_COMPLETE=PASS');
assert.throws(() => exactSha('bad'), /COUNCIL_BRIDGE_EXACT_SHA_INVALID/);
console.log('COUNCIL_BRIDGE_IDENTITY_GUARD=PASS');
