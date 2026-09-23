#!/usr/bin/env node
import assert from 'node:assert/strict';
import { FLIXO_WORKER_IDS, FLIXO_ACTIVE_WORKER_GUARD, assertActiveWorkerGuardDefinition, nextFlixoWorker, evaluateWorkerClaim, buildActiveWorkerSeat } from './flixo-active-worker-guard.mjs';

assertActiveWorkerGuardDefinition();
assert.equal(FLIXO_WORKER_IDS.length, 10);
assert.equal(nextFlixoWorker('FLIXO1'), 'FLIXO2');
assert.equal(nextFlixoWorker('FLIXO10'), 'FLIXO1');

const sha='a'.repeat(40);
const first=evaluateWorkerClaim({seat:null,requestedAgent:'FLIXO1',taskId:'TASK-1',sessionId:'S1',targetSha:sha});
assert.equal(first.allowed,true);
assert.equal(first.action,'INITIAL_CLAIM');

assert.throws(
  () => evaluateWorkerClaim({seat:null,requestedAgent:'FLIXO2',taskId:'TASK-1',sessionId:'S2',targetSha:sha}),
  /INITIAL_SLOT_RESERVED_FOR=FLIXO1/u
);

const seat=buildActiveWorkerSeat({taskId:'TASK-1',sessionId:'S1',agentId:'FLIXO1',targetSha:sha});
assert.equal(seat.agentId,'FLIXO1');
assert.equal(seat.simultaneousActiveWorkers,1);

assert.throws(
  () => evaluateWorkerClaim({seat,requestedAgent:'FLIXO2',taskId:'TASK-1',sessionId:'S2',targetSha:sha,now:Date.parse(seat.heartbeatAt)+30_000}),
  /ACTIVE_WORKER_GUARD_BUSY=FLIXO1:TASK-1/u
);

assert.throws(
  () => evaluateWorkerClaim({seat,requestedAgent:'FLIXO3',taskId:'TASK-1',sessionId:'S3',targetSha:sha,now:Date.parse(seat.heartbeatAt)+120_000}),
  /ACTIVE_WORKER_GUARD_NEXT_REQUIRED=FLIXO2/u
);

const takeover=evaluateWorkerClaim({seat,requestedAgent:'FLIXO2',taskId:'TASK-1',sessionId:'S2',targetSha:sha,now:Date.parse(seat.heartbeatAt)+120_000});
assert.equal(takeover.allowed,true);
assert.equal(takeover.action,'FAILOVER_CLAIM');
assert.equal(takeover.previousAgent,'FLIXO1');

console.log('FLIXO_ACTIVE_WORKER_GUARD=PASS');
