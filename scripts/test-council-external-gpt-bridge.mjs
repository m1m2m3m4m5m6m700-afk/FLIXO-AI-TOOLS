#!/usr/bin/env node
import assert from 'node:assert/strict';
import http from 'node:http';
import {
  buildConfig,
  pollDispatch,
  ackDispatch,
  completeDispatch,
  executeExternalAgent,
  createBridge,
  createWakeServer,
} from './council/external-gpt-bridge.mjs';

const SHA = 'a'.repeat(40);
const calls = [];
let delivered = false;

const mockFetch = async (url, init = {}) => {
  const u = new URL(url);
  const body = init.body ? JSON.parse(init.body) : null;
  calls.push({ path: u.pathname, action: u.searchParams.get('action'), method: init.method ?? 'GET', body });

  if (u.hostname === 'runtime.test') {
    if (u.searchParams.get('action') === 'poll') {
      if (delivered) return new Response(JSON.stringify({ ok: true, dispatch: null }), { status: 200 });
      delivered = true;
      return new Response(JSON.stringify({
        ok: true,
        dispatch: {
          dispatch_id: 'dispatch-001',
          task_id: 'GREEN-RECOVERY-001',
          work_package_id: 'ROOT-CAUSE-SPINE-001',
          entry_sha: SHA,
          payload: { reason: 'test-wake' },
        },
      }), { status: 200 });
    }
    if (['ack', 'heartbeat', 'complete'].includes(u.searchParams.get('action'))) {
      return new Response(JSON.stringify({ ok: true, dispatch: body }), { status: 200 });
    }
  }

  if (u.hostname === 'executor.test') {
    assert.equal(body.protocol, 'FLIXO_EXTERNAL_GPT_BRIDGE_V1');
    assert.equal(body.accountId, 'WORKER_A');
    assert.equal(body.exactSha, SHA);
    return new Response(JSON.stringify({
      status: 'DONE',
      evidence: { executor: 'mock', verified: true },
      payload: { result: 'wake-cycle-complete' },
    }), { status: 200 });
  }

  throw new Error('unexpected mock URL: ' + url);
};

const config = buildConfig('WORKER_A', {
  COUNCIL_RUNTIME_URL: 'https://runtime.test/functions/v1/flixo-council-runtime',
  COUNCIL_WORKER_A_TOKEN: 'worker-token',
  COUNCIL_WORKER_A_BRIDGE_PORT: '0',
  COUNCIL_WORKER_A_AGENT_ENDPOINT: 'https://executor.test/execute',
  COUNCIL_WORKER_A_AGENT_TOKEN: 'executor-token',
});

const dispatch = await pollDispatch(config, mockFetch);
assert.equal(dispatch.entry_sha, SHA);
await ackDispatch(config, dispatch, 'session-001', mockFetch);
const result = await executeExternalAgent(config, dispatch, 'session-001', mockFetch);
assert.equal(result.status, 'DONE');
assert.equal(result.evidence.verified, true);
await completeDispatch(config, dispatch, 'session-001', 'DONE', result.evidence, result.payload, mockFetch);

const bridge = createBridge({ config, fetchImpl: mockFetch, heartbeatMs: 60_000 });
const processed = await bridge.processOnce();
assert.equal(processed, false);
assert.equal(bridge.status.accountId, 'WORKER_A');

const wakeServer = createWakeServer({ config, bridge });
await new Promise((resolve) => wakeServer.listen(0, '127.0.0.1', resolve));
const port = wakeServer.address().port;

const unauthorized = await fetch('http://127.0.0.1:' + port + '/wake', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ accountId: 'WORKER_A', exactSha: SHA }),
});
assert.equal(unauthorized.status, 401);

const authorized = await fetch('http://127.0.0.1:' + port + '/wake', {
  method: 'POST',
  headers: {
    authorization: 'Bearer worker-token',
    'content-type': 'application/json',
  },
  body: JSON.stringify({ accountId: 'WORKER_A', exactSha: SHA, dispatchId: 'dispatch-001' }),
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
console.log('COUNCIL_EXTERNAL_GPT_BRIDGE_WAKE_AUTH=PASS');
console.log('COUNCIL_EXTERNAL_GPT_BRIDGE_EXACT_SHA=PASS');
console.log('COUNCIL_EXTERNAL_GPT_BRIDGE_ACK_COMPLETE=PASS');
