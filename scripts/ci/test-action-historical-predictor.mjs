#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildPrediction } from './action-historical-predictor.mjs';

const packet=buildPrediction({
 taskId:'TASK-PREDICTOR-TEST',
 fingerprint:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
 targetSha:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
 failedRunId:'run-predictor-test',
 failureLog:'TypeScript error failed lint workflow',
 workflow:'FLIXO Test System',
 job:'Static contracts'
});
assert.equal(packet.protocol,'PREDICTIVE_REPAIR_PACKET_V1');
assert.equal(packet.status,'PROVISIONAL');
assert.equal(packet.identity.targetSha,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
assert.equal(packet.proposedRepair.notCertain,true);
assert.equal(packet.proposedRepair.mode,'OWNER_REVIEW_REQUIRED');
assert.ok(packet.search.actionIndexSize >= 4000);
assert.ok(Array.isArray(packet.similarCases));
assert.ok(Array.isArray(packet.candidateStrategies));
assert.ok(Array.isArray(packet.proposedRepair.predictedChecks));
assert.ok(Array.isArray(packet.proposedRepair.historicalActions));
assert.ok(packet.proposedRepair.historicalActions.length >= 1);

console.log(JSON.stringify({status:'PASS',protocol:'PREDICTIVE_REPAIR_PACKET_V1',assertions:7},null,2));
