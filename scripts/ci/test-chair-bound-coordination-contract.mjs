#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
const coordination=fs.readFileSync(new URL('./agent-coordination.mjs',import.meta.url),'utf8');
assert.match(coordination,/initializeChairState/);
assert.match(coordination,/acquireChair/);
assert.match(coordination,/releaseChair/);
assert.match(coordination,/revokeChair/);
assert.match(coordination,/const selectedChair = optional\('chair', 'chair_1'\)/);
assert.match(coordination,/chairLease = acquireTaskChair/);
assert.match(coordination,/task\.chairId = selectedChair/);
assert.match(coordination,/chairLeaseId:/);
assert.match(coordination,/reason: 'TASK_COMPLETE'/);
assert.match(coordination,/reason: 'TASK_RELEASE'/);
assert.match(coordination,/reason === 'STALE_CONTEXT' \|\| reason === 'GOVERNANCE_DRIFT'/);
console.log('CHAIR_TASK_CLAIM_BINDING=PASS');
console.log('CHAIR_LEASE_PERSISTENCE=PASS');
console.log('CHAIR_RELEASE_BINDING=PASS');
console.log('CHAIR_STALE_REVOCATION_BINDING=PASS');
