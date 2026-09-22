#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const registry=JSON.parse(fs.readFileSync('docs/agents/CELL-BOT-REGISTRY.json','utf8'));
const protocol=JSON.parse(fs.readFileSync('docs/PROTOCOL-REGISTRY.json','utf8'));
const contract=fs.readFileSync('docs/agents/SHARED-SIX-BOT-OPERATIONAL-MEMORY-CONTRACT.md','utf8');

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
assert.equal(p22?.participants.length,6);
assert.equal(p22?.sharedMemory,'diagnostics/auto-repair/SHARED-OPERATIONAL-MEMORY.json');

for(const marker of ['FLIXO-SHARED-OPERATIONAL-MEMORY-v1','Every published record is visible to all six participants','exact-SHA-bound','learning','authority']) assert(contract.toLowerCase().includes(marker.toLowerCase()));

console.log('SHARED_OPERATIONAL_MEMORY_CONTRACT_TEST=PASS');
console.log('RETIRED_CELL_POOL_CONTRACT=PASS');
console.log('P21_RETIRED=PASS');
console.log('P22_SHARED_MEMORY=PASS');
