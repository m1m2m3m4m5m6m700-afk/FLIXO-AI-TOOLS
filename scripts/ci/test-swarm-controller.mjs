#!/usr/bin/env node
import assert from 'node:assert/strict';
import {loadSwarmRegistry,planSwarm} from './swarm-controller.mjs';

const registry=loadSwarmRegistry();
assert.equal(registry.status,'RETIRED');
assert.deepEqual(registry.bots,[]);
assert.equal(registry.swarmPolicy?.status,'RETIRED');
assert.equal(registry.swarmPolicy?.registeredBots,0);
assert.deepEqual(registry.swarmPolicy?.activeRange,[0,0]);
assert.equal(registry.lifecycle?.automaticReprovisioning,false);
assert.equal(registry.lifecycle?.reason,'USER_DIRECTIVE_HISTORICAL_RUNTIME_POOL_RETIREMENT');
assert.equal(registry.executiveCellGovernance?.retired,true);
assert.equal(registry.executiveCellGovernance?.targetBotCount,0);
assert.equal(registry.sharedOperationalMemoryContract?.status,'RETIRED');
assert.equal(registry.sharedOperationalMemoryContract?.distribution?.targetBotCount,0);

const plan=planSwarm();
assert.deepEqual(plan,{
  status:'RETIRED',
  botCount:0,
  reason:'CELL_POOL_RETIRED_BY_USER_DIRECTIVE',
});

console.log('SWARM_CONTROLLER=PASS');
console.log('SWARM_RETIREMENT=PASS');
console.log('SWARM_NO_REPROVISION=PASS');
