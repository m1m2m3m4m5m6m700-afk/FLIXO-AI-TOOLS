#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const registry=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/agents/CELL-BOT-REGISTRY.json'),'utf8'));
const ledger=JSON.parse(fs.readFileSync(path.join(ROOT,'docs/agents/CELL-HONORARY-STARS.json'),'utf8'));

assert.equal(ledger.rules.range[0],0);
assert.equal(ledger.rules.range[1],5);
assert.equal(ledger.rules.awardUnit,1);
assert.equal(ledger.rules.trigger,'EXCEPTIONAL_WORK');
assert.equal(ledger.rules.fiveStarRank,'MASTER-1');
assert.equal(ledger.rules.formalTransitionRequired,true);
assert.equal(ledger.rules.automaticPrivilegeChange,false);

const ids=new Set();
for(const award of ledger.awards){
  assert.equal(typeof award.awardEventId,'string');
  assert.equal(typeof award.holder,'string');
  assert.equal(typeof award.starsAfterAward,'number');
  assert(award.starsAfterAward>=1 && award.starsAfterAward<=5);
  assert.equal(ids.has(award.awardEventId),false,'DUPLICATE_AWARD_EVENT_ID');
  ids.add(award.awardEventId);
  assert.equal(typeof award.sourceMessageId,'string');
}
const master3=ledger.awards.filter(x=>x.holder==='MASTER-3').at(-1);
assert.equal(master3?.starsAfterAward,1);
assert.equal(registry.honoraryStarSystem?.ceiling,5);
assert.equal(registry.honoraryStarSystem?.fiveStarRank,'MASTER-1');
console.log('CELL_HONORARY_STARS=PASS');
console.log('CELL_HONORARY_STAR_CEILING=PASS');
console.log('CELL_HONORARY_STAR_EVIDENCE=PASS');
