#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const registry=JSON.parse(fs.readFileSync('docs/agents/CELL-BOT-REGISTRY.json','utf8'));
const protocol=JSON.parse(fs.readFileSync('docs/PROTOCOL-REGISTRY.json','utf8'));
const contract=fs.readFileSync('docs/agents/SHARED-SIX-BOT-OPERATIONAL-MEMORY-CONTRACT.md','utf8');
const flixoBot=JSON.parse(fs.readFileSync('docs/agents/FLIXO-BOT.json','utf8'));

assert.equal(registry.status,'RETIRED');
assert.equal(registry.bots.length,0);
assert.equal(registry.executiveCellGovernance.status,'RETIRED');
assert.equal(registry.executiveCellGovernance.targetBotCount,0);
assert.equal(registry.lifecycle.automaticReprovisioning,false);

const p21=protocol.protocols.find((p)=>p.id==='P21');
assert.equal(p21?.status,'RETIRED');
assert.equal(p21?.canonicalSource,'docs/agents/SHARED-OPERATIONAL-MEMORY-CONTRACT.md');
assert.ok(Array.isArray(p21?.scope));
assert.ok(p21.scope.every((id)=>/^CELL-\d{3}$/u.test(id) || id==='ALL_CELL_BOTS'));
assert.equal(p21?.sharedMemory,'diagnostics/auto-repair/cell-knowledge/index.json');

const p22=protocol.protocols.find((p)=>p.id==='P22');
assert.equal(p22?.status,'MANDATORY');
assert.equal(p22?.sharedMemory,'diagnostics/auto-repair/SHARED-OPERATIONAL-MEMORY.json');
assert.equal(p22?.participantsSource,'docs/agents/FLIXO-BOT.json#/distribution/learningConsumers');
assert.ok(Array.isArray(flixoBot?.distribution?.learningConsumers));
assert.ok(flixoBot.distribution.learningConsumers.length>6);
assert.equal(new Set(flixoBot.distribution.learningConsumers).size,flixoBot.distribution.learningConsumers.length);
for(const required of ['ACTION-REPAIR','ACTION-REPAIR-2','ACTION-HISTORIAN-3','ACTION-ARBITER','ACTION-COUNCIL-20','SECURITY-REDTEAM-3','assistantController','MASTER-1','MASTER-2','MASTER-3','executionAgent','reviewAgent','execution-agent-clone-v1','CHIEF','WORKER_A','WORKER_B']) assert(flixoBot.distribution.learningConsumers.includes(required));
assert(!flixoBot.distribution.learningConsumers.includes('ACTION-WAKE'));
assert(!flixoBot.distribution.learningConsumers.some((id)=>/^CELL-\\d{3}$/u.test(id)));

for(const marker of ['FLIXO-SHARED-OPERATIONAL-MEMORY-v1','Every published record is visible to every active FLIXO BOT learning consumer','exact-SHA-bound','learning','authority','execution-agent-clone-v1','FLIXO-BIDIRECTIONAL-COGNITIVE-MESH-v1']) assert(contract.toLowerCase().includes(marker.toLowerCase()));

console.log('SHARED_OPERATIONAL_MEMORY_CONTRACT_TEST=PASS');
console.log('RETIRED_CELL_POOL_CONTRACT=PASS');
console.log('P21_RETIRED=PASS');
console.log('P22_SHARED_MEMORY_SYSTEM_WIDE=PASS');
console.log('FLIXO_BOT_GLOBAL_INTELLIGENCE_CONTRACT=PASS');
