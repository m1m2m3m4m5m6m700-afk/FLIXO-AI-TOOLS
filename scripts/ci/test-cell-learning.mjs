#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
const testDir='/tmp/flixo-cell-learning-test-'+process.pid;
fs.rmSync(testDir,{recursive:true,force:true});
process.env.FLIXO_CELL_BOT_MEMORY_DIR=testDir;
const {buildKnowledgeRecord,deriveBotUpgrade}=await import('./cell-learning.mjs');
const sha='0123456789abcdef0123456789abcdef01234567';
const record=buildKnowledgeRecord({
  botId:'CELL-001',
  taskId:'CELL-TASK-ACTION-ERRORS',
  taskShortName:'ACTION_SOLUTION_INDEXER',
  taskName:'ACTION_SOLUTION_INDEXER',
  fingerprint:'fp-action-errors',
  normalizedFailure:'ERROR new action failure',
  rootCause:'historical-actions',
  outcome:'failure',
  verification:'diagnostic-complete',
  targetSha:sha,
  runId:'35509813525',
  attempts:1,
  successes:0,
  upgradeNumber:1,
  upgradePriority:95,
  weakness:'HISTORICAL_ACTION_COVERAGE',
  solution:{strategyId:'read-actions',outcome:'failure'}
});
assert.equal(record.taskIdentity.shortName,'ACTION_SOLUTION_INDEXER');
assert.equal(record.botProfile.botId,'CELL-001');
assert.equal(record.solution.strategyId,'read-actions');
assert.equal(record.normalizedFailure,'ERROR new action failure');
assert.equal(record.botProfile.upgrade.upgradeNumber,2);
assert.equal(record.botProfile.upgrade.state,'UPGRADING');
assert.equal(record.botProfile.lifecycle.noRawTerminalState,true);
const ready=deriveBotUpgrade({outcome:'success',validation:{validated:true},attempts:2,successes:2,upgradeNumber:2,upgradePriority:90,weakness:'NEXT_GENERALIZATION'});
assert.equal(ready.state,'READY');
assert.equal(ready.upgradeNumber,3);
assert(ready.upgradePriority>=1&&ready.upgradePriority<=100);
fs.rmSync(testDir,{recursive:true,force:true});
console.log('CELL_ADAPTIVE_LEARNING=PASS');
