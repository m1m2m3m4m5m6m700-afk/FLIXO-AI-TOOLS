#!/usr/bin/env node
import assert from 'node:assert/strict';
import { buildSoftwareEngineerPacket } from './action-software-engineer-core.mjs';

const packet=buildSoftwareEngineerPacket({
  taskId:'TASK-SEC-CORE',
  fingerprint:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  targetSha:'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  failedRunId:'run-sec-core',
  baseSha:'cccccccccccccccccccccccccccccccccccccccc',
  paths:['scripts/ci/action-software-engineer-core.mjs','package.json'],
  deep:true
});
assert.equal(packet.protocol,'LOCAL_SOFTWARE_ENGINEER_CORE_V1');
assert.equal(packet.localOnly,true);
assert.equal(packet.serverless,true);
assert.equal(packet.safety.noServer,true);
assert.equal(packet.safety.noNetwork,true);
assert.equal(packet.safety.noSourceMutation,true);
assert.equal(packet.safety.noMainMutation,true);
assert.equal(packet.safety.noTestMutation,true);
assert.equal(packet.identity.targetSha,'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');
assert.ok(packet.codeIndex.length===2);
assert.ok(packet.impact.predictedChecks.includes('npm run typecheck'));
assert.ok(packet.impact.predictedChecks.includes('npm run lint'));
assert.equal(packet.review.mutationPerformed,false);
assert.ok(typeof packet.review.riskScore==='number');

assert.throws(()=>buildSoftwareEngineerPacket({
  taskId:'TASK',fingerprint:'f',targetSha:'bad',failedRunId:'run'
}),/EXACT|IDENTITY/);

console.log(JSON.stringify({status:'PASS',protocol:'LOCAL_SOFTWARE_ENGINEER_CORE_V1',assertions:14},null,2));
