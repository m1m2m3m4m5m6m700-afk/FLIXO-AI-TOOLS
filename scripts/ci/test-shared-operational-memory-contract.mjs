#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root=new URL('..',import.meta.url);
const registry=JSON.parse(fs.readFileSync(new URL('../docs/agents/CELL-BOT-REGISTRY.json',root),'utf8'));
const protocol=JSON.parse(fs.readFileSync(new URL('../docs/PROTOCOL-REGISTRY.json',root),'utf8'));
const contract=fs.readFileSync(new URL('../docs/agents/SHARED-OPERATIONAL-MEMORY-CONTRACT.md',root),'utf8');

const memory=registry.sharedOperationalMemoryContract;
assert.equal(memory.contractId,'CELL-SHARED-OPERATIONAL-MEMORY-001');
assert.equal(memory.status,'MANDATORY');
assert.equal(memory.distribution.targetBotCount,200);
assert.equal(memory.botIdentityBinding.length,200);
assert.equal(memory.canonicalMemory.authority,'CELL_KNOWLEDGE_INDEX');
assert.equal(memory.canonicalMemory.path,'diagnostics/auto-repair/cell-knowledge/index.json');
assert.equal(memory.publicationGate.validationRequired,true);
assert.equal(memory.publicationGate.exactShaRequired,true);
assert.equal(memory.publicationGate.unprovenLearningMayNotPublish,true);
assert.deepEqual(memory.distribution.syncStates,['CURRENT','SYNC_PENDING','STALE','SYNC_FAILED']);

const p21=protocol.protocols.find((p)=>p.id==='P21');
assert.equal(p21?.status,'MANDATORY');
assert.equal(p21?.sharedMemory,'diagnostics/auto-repair/cell-knowledge/index.json');
assert.equal(p21?.canonicalSource,'docs/agents/SHARED-OPERATIONAL-MEMORY-CONTRACT.md');

for(const marker of ['CELL-SHARED-OPERATIONAL-MEMORY-001','CELL_KNOWLEDGE_INDEX','CELL_MEMORY_UPDATED','memoryVersion','MEMORY_CONFLICT','knowledge does not grant authority']) assert(contract.includes(marker));

console.log('SHARED_OPERATIONAL_MEMORY_CONTRACT_TEST=PASS');
