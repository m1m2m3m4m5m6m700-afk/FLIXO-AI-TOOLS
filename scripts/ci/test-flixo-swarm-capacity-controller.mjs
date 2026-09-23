import assert from 'node:assert/strict';
import { FLIXO_SWARM_CAPACITY_POLICY, validateCapacityPolicy, validateGovernancePolicy, decideCapacity } from './flixo-swarm-capacity-controller.mjs';

assert.equal(validateCapacityPolicy(),true);
assert.equal(validateGovernancePolicy(),true);
assert.equal(FLIXO_SWARM_CAPACITY_POLICY.governance.authorityOwner,'CANONICAL_CONTROL_PLANE');
assert.equal(FLIXO_SWARM_CAPACITY_POLICY.governance.mutationOwner,'ACTION-REPAIR');
assert.equal(FLIXO_SWARM_CAPACITY_POLICY.governance.publicationAuthority,'CHAIR_1_ONLY');
assert.equal(FLIXO_SWARM_CAPACITY_POLICY.governance.certificationAuthority,'DAILY_FLIXO_GREEN_GATE');
assert.equal(FLIXO_SWARM_CAPACITY_POLICY.governance.scaleNeverGrantsMutationAuthority,true);
assert.equal(FLIXO_SWARM_CAPACITY_POLICY.governance.scaleNeverCreatesNewGovernancePlane,true);
assert.equal(FLIXO_SWARM_CAPACITY_POLICY.governance.workersCannotSelfPromote,true);
assert.equal(FLIXO_SWARM_CAPACITY_POLICY.governance.failClosedOnGovernanceDrift,true);
assert.equal(FLIXO_SWARM_CAPACITY_POLICY.minimumActiveRuntimeCount,5);
assert.equal(FLIXO_SWARM_CAPACITY_POLICY.maximumActiveRuntimeCount,500);
assert.equal(FLIXO_SWARM_CAPACITY_POLICY.neverFabricateLiveBots,true);
assert.equal(FLIXO_SWARM_CAPACITY_POLICY.minimumVerifiedResidentRuntimeCount,10);
assert.equal(FLIXO_SWARM_CAPACITY_POLICY.requiredSurplusRuntimeCount,5);

const sha='a'.repeat(40);
assert.equal(decideCapacity({activeRuntimeCount:5,provisionedRuntimeCount:10,queuedTasks:0,exactSha:sha}).action,'HOLD');
const noSurplus=decideCapacity({activeRuntimeCount:5,provisionedRuntimeCount:5,queuedTasks:0,liveBots:5,exactSha:sha});
assert.equal(noSurplus.action,'REQUEST_PROVISIONING');
assert.equal(noSurplus.reason,'SURPLUS_FIVE_RUNTIME_SEATS_REQUIRED');
assert.equal(noSurplus.failClosed,true);
assert.equal(decideCapacity({activeRuntimeCount:4,provisionedRuntimeCount:10,liveBots:4,exactSha:sha}).action,'RECOVER_TO_FLOOR');
assert.equal(decideCapacity({activeRuntimeCount:5,provisionedRuntimeCount:10,queuedTasks:30,liveBots:5,exactSha:sha}).action,'SCALE_UP');
assert.equal(decideCapacity({activeRuntimeCount:5,provisionedRuntimeCount:10,unresponsiveActiveRuntimeCount:1,liveBots:5,exactSha:sha}).action,'REPLACE_UNRESPONSIVE');
const lazy=decideCapacity({activeRuntimeCount:10,provisionedRuntimeCount:10,unresponsiveActiveRuntimeCount:1,liveBots:10,exactSha:sha});
assert.equal(lazy.action,'REQUEST_PROVISIONING');
assert.equal(lazy.lazyBotDetected,true);
assert.equal(lazy.replacementRequired,true);
assert.equal(lazy.failClosed,true);

assert.equal(decideCapacity({activeRuntimeCount:10,provisionedRuntimeCount:10,queuedTasks:50,liveBots:10,exactSha:sha}).action,'REQUEST_PROVISIONING');
assert.equal(decideCapacity({activeRuntimeCount:500,provisionedRuntimeCount:500,queuedTasks:5000,liveBots:500,exactSha:sha}).desiredActiveRuntimeCount,500);
const scale=decideCapacity({activeRuntimeCount:5,provisionedRuntimeCount:500,queuedTasks:20,liveBots:5,exactSha:sha});
assert.equal(scale.desiredActiveRuntimeCount,10);
assert.equal(scale.governancePreserved,true);
assert.equal(scale.scaleDoesNotGrantAuthority,true);
assert.equal(decideCapacity({activeRuntimeCount:5,provisionedRuntimeCount:10,queuedTasks:20,liveBots:5,exactSha:'bad'}).action,'BLOCK');
assert.equal(decideCapacity({activeRuntimeCount:5,provisionedRuntimeCount:10,queuedTasks:20,liveBots:6,exactSha:sha}).action,'BLOCK');

console.log('FLIXO_DYNAMIC_SWARM_CAPACITY=PASS');
