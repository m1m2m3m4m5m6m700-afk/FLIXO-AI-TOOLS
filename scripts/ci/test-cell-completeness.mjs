#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const ROOT=process.cwd();
const ids=Array.from({length:200},(_,i)=>`CELL-${String(i+1).padStart(3,'0')}`);
const registry=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/agents/CELL-BOT-REGISTRY.json'),'utf8'));
const index=JSON.parse(fs.readFileSync(path.join(ROOT,'diagnostics/auto-repair/cell-knowledge/index.json'),'utf8'));
const memoryDir=path.join(ROOT,'diagnostics/auto-repair/cell-bots');
const knowledgeDir=path.join(ROOT,'diagnostics/auto-repair/cell-knowledge');

assert.equal(registry.bots.length,200);
assert.deepEqual(registry.bots.map(x=>x.id),ids);
assert.equal(registry.swarmPolicy?.registeredBots,200);
assert.deepEqual(registry.swarmPolicy?.escalationLadder,[3,7,15,30,50,100,200]);
assert.equal(registry.personalMemory?.aggregateIndex,'diagnostics/auto-repair/cell-knowledge/index.json');
assert.equal(registry.cellCouncil?.seats?.length,3);
assert.deepEqual(registry.cellCouncil?.seats?.map(x=>x.id),['CELL-SEAT-01','CELL-SEAT-02','CELL-SEAT-03']);

for(const id of ids){
  const memoryFile=path.join(memoryDir,id+'.json');
  const knowledgeFile=path.join(knowledgeDir,id+'.json');
  assert.equal(fs.existsSync(memoryFile),true,`MISSING_CELL_MEMORY=${id}`);
  assert.equal(fs.existsSync(knowledgeFile),true,`MISSING_CELL_KNOWLEDGE=${id}`);
  const memory=JSON.parse(fs.readFileSync(memoryFile,'utf8'));
  const knowledge=JSON.parse(fs.readFileSync(knowledgeFile,'utf8'));
  assert.equal(memory.botId,id);
  assert.equal(memory.copyable,true);
  assert.equal(memory.transferableKnowledgeOnly,true);
  assert.equal(memory.permanentIndependentAuthority,false);
  assert.equal(knowledge.botId,id);
  assert.equal(knowledge.identity.writerId,id);
}

assert.equal(index.totalBots,200);
assert.equal(index.bots.length,200);
assert.deepEqual(index.bots.map(x=>x.botId),ids);
assert(index.bots.every(x=>x.file===`${x.botId}.json`&&x.status==='RAW'&&x.upgradePriority===1&&x.taskCount===0&&x.knowledgeCount===0));

for(const file of [
  'scripts/ci/cell-attendance.mjs',
  'scripts/ci/cell-bootstrap-200.mjs',
  'scripts/ci/cell-controller.mjs',
  'scripts/ci/cell-fanout.mjs',
  'scripts/ci/cell-learning.mjs',
  'scripts/ci/cell-memory.mjs',
  'scripts/ci/cell-wake-preparation.mjs',
  'scripts/ci/swarm-controller.mjs'
]){
  execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
}

console.log('CELL_PERSISTENT_POOL=PASS');
console.log('CELL_200_MEMORY=PASS');
console.log('CELL_200_KNOWLEDGE_INDEX=PASS');
console.log('CELL_RUNTIME_SYNTAX=PASS');
console.log('CELL_COMPLETENESS=PASS');
