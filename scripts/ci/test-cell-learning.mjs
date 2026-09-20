import assert from 'node:assert/strict';
import { buildKnowledgeRecord, deriveBotUpgrade } from './cell-learning.mjs';

const sha='0123456789abcdef0123456789abcdef01234567';
const record=buildKnowledgeRecord({
  botId:'CELL-001',
  taskId:'CELL-TASK-ACTION-ERRORS',
  taskShortName:'ACTERR',
  taskName:'ACTION_ERROR_READER',
  fingerprint:'fp-action-errors',
  rootCause:'historical-actions',
  outcome:'failure',
  verification:'diagnostic-complete',
  targetSha:sha,
  runId:'35509813525',
  attempts:1,
  successes:0,
  upgradeNumber:1,
  upgradePriority:95,
  weakness:'HISTORICAL_ACTION_COVERAGE'
});
assert.equal(record.taskIdentity.shortName,'ACTERR');
assert.equal(record.botProfile.botId,'CELL-001');
assert.equal(record.botProfile.upgrade.upgradeNumber,2);
assert.equal(record.botProfile.upgrade.state,'UPGRADING');
assert.equal(record.botProfile.lifecycle.noRawTerminalState,true);

const ready=deriveBotUpgrade({outcome:'success',validation:{validated:true},attempts:2,successes:2,upgradeNumber:2,upgradePriority:90,weakness:'NEXT_GENERALIZATION'});
assert.equal(ready.state,'READY');
assert.equal(ready.upgradeNumber,3);
assert(ready.upgradePriority>=1&&ready.upgradePriority<=100);

console.log('CELL_ADAPTIVE_LEARNING=PASS');
