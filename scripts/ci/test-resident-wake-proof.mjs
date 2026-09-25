import assert from 'node:assert/strict';
import {
  buildResidentReadyAck,
  verifyResidentHandoffProof,
  isNextResidentRuntimeReady,
} from './resident-wake-proof.mjs';

const sha='a'.repeat(40);
const baton={
  schemaVersion:1,
  protocol:'FLIXO-RESIDENT-WAKE-BATON-v1',
  action:'WAKE_NEXT_RESIDENT_BOT',
  actor:'FLIXO1',
  nextActor:'FLIXO6',
  targetSha:sha,
  taskId:'REDTEAM-RESIDENT-001',
  issuedAt:'2026-09-25T00:00:00.000Z',
  expiresAt:'2026-09-25T00:01:30.000Z',
  minimumResidentFloor:1,
  nextMustAckBeforeRelease:true,
  mutationAuthority:false,
  pushAuthority:'CHAIR_1_ONLY',
};

const runtimeReadyWake={
  targetSha:sha,
  stagedRuntimeIds:['FLIXO6','FLIXO7'],
  nextRuntimeIds:['FLIXO8','FLIXO9','FLIXO10'],
  nextBotIds:['CELL-126','CELL-127','CELL-128','CELL-129','CELL-130'],
};
assert.equal(isNextResidentRuntimeReady(runtimeReadyWake,'FLIXO6'),true);
assert.equal(isNextResidentRuntimeReady(runtimeReadyWake,'FLIXO10'),true);
assert.equal(isNextResidentRuntimeReady(runtimeReadyWake,'CELL-126'),false);
assert.equal(isNextResidentRuntimeReady(runtimeReadyWake,'FLIXO2'),false);

const ack=buildResidentReadyAck({
  baton,
  responder:'FLIXO6',
  now:'2026-09-25T00:00:30.000Z',
});

const proof=verifyResidentHandoffProof({
  baton,
  ack,
  observer:'FLIXO_EXECUTION_WATCHDOG',
  now:'2026-09-25T00:00:31.000Z',
});

assert.equal(ack.protocol,'FLIXO-RESIDENT-READY-ACK-v1');
assert.equal(ack.action,'RESIDENT_NEXT_READY');
assert.equal(ack.targetSha,sha);
assert.equal(ack.actor,'FLIXO1');
assert.equal(ack.responder,'FLIXO6');
assert.equal(ack.ready,true);
assert.equal(ack.readyState,'READY_RESIDENT');
assert.equal(ack.liveHeartbeatAck,false);
assert.equal(ack.independentObservationRequired,true);
assert.equal(proof.status,'PASS');
assert.equal(proof.independentObserver,true);
assert.equal(proof.releaseAllowed,true);
assert.equal(proof.liveHeartbeatStillRequired,true);
assert.equal(proof.minimumResidentFloor,1);

assert.throws(
  ()=>verifyResidentHandoffProof({
    baton,
    ack:{...ack,targetSha:'b'.repeat(40)},
    observer:'FLIXO_EXECUTION_WATCHDOG',
    now:'2026-09-25T00:00:31.000Z',
  }),
  /RESIDENT_PROOF_ACK_SHA_MISMATCH/u,
);

assert.throws(
  ()=>buildResidentReadyAck({
    baton:{...baton,nextActor:'FLIXO7'},
    responder:'FLIXO6',
    now:'2026-09-25T00:00:30.000Z',
  }),
  /RESIDENT_PROOF_RESPONDER_MUST_BE_NEXT_ACTOR/u,
);

assert.throws(
  ()=>verifyResidentHandoffProof({
    baton,
    ack,
    observer:'FLIXO1',
    now:'2026-09-25T00:00:31.000Z',
  }),
  /RESIDENT_PROOF_OBSERVER_NOT_INDEPENDENT/u,
);

assert.throws(
  ()=>verifyResidentHandoffProof({
    baton,
    ack,
    observer:'FLIXO_EXECUTION_WATCHDOG',
    now:'2026-09-25T00:02:00.000Z',
  }),
  /RESIDENT_PROOF_BATON_EXPIRED/u,
);

assert.throws(
  ()=>verifyResidentHandoffProof({
    baton,
    ack:{...ack,liveHeartbeatAck:true},
    observer:'FLIXO_EXECUTION_WATCHDOG',
    now:'2026-09-25T00:00:31.000Z',
  }),
  /RESIDENT_PROOF_READY_ACK_CANNOT_CLAIM_LIVE_HEARTBEAT/u,
);

assert.throws(
  ()=>buildResidentReadyAck({
    baton:{...baton,targetSha:'bad'},
    responder:'FLIXO6',
    now:'2026-09-25T00:00:30.000Z',
  }),
  /RESIDENT_PROOF_BATON_EXACT_SHA_REQUIRED/u,
);

console.log(JSON.stringify({
  status:'PASS',
  suite:'resident-wake-proof-red-team',
  cases:7,
  verified:['exact-sha','next-actor-binding','independent-observer','ttl-expiry','no-false-heartbeat','fingerprint-integrity','resident-floor'],
},null,2));
