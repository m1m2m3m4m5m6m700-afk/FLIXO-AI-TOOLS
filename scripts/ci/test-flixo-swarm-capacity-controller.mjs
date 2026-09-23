import assert from 'node:assert/strict';
import { FLIXO_SWARM_CAPACITY_POLICY, validateCapacityPolicy, decideCapacity } from './flixo-swarm-capacity-controller.mjs';

assert.equal(validateCapacityPolicy(),true);
assert.equal(FLIXO_SWARM_CAPACITY_POLICY.minimumActiveRuntimeCount,5);
assert.equal(FLIXO_SWARM_CAPACITY_POLICY.maximumActiveRuntimeCount,500);
assert.equal(FLIXO_SWARM_CAPACITY_POLICY.neverFabricateLiveBots,true);

const sha='a'.repeat(40);
assert.equal(decideCapacity({activeRuntimeCount:5,provisionedRuntimeCount:10,queuedTasks:0,exactSha:sha}).action,'HOLD');
assert.equal(decideCapacity({activeRuntimeCount:4,provisionedRuntimeCount:10,liveBots:4,exactSha:sha}).action,'RECOVER_TO_FLOOR');
assert.equal(decideCapacity({activeRuntimeCount:5,provisionedRuntimeCount:10,queuedTasks:30,liveBots:5,exactSha:sha}).action,'SCALE_UP');
assert.equal(decideCapacity({activeRuntimeCount:10,provisionedRuntimeCount:10,queuedTasks:50,liveBots:10,exactSha:sha}).action,'REQUEST_PROVISIONING');
assert.equal(decideCapacity({activeRuntimeCount:500,provisionedRuntimeCount:500,queuedTasks:5000,liveBots:500,exactSha:sha}).desiredActiveRuntimeCount,500);
assert.equal(decideCapacity({activeRuntimeCount:5,provisionedRuntimeCount:500,queuedTasks:20,liveBots:5,exactSha:sha}).desiredActiveRuntimeCount,10);
assert.equal(decideCapacity({activeRuntimeCount:5,provisionedRuntimeCount:10,queuedTasks:20,liveBots:5,exactSha:'bad'}).action,'BLOCK');
assert.equal(decideCapacity({activeRuntimeCount:5,provisionedRuntimeCount:10,queuedTasks:20,liveBots:6,exactSha:sha}).action,'BLOCK');

console.log('FLIXO_DYNAMIC_SWARM_CAPACITY=PASS');
