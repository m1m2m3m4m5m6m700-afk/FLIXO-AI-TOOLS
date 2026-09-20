#!/usr/bin/env node
import assert from 'node:assert/strict';
import {CELL_RESULT_REVIEWER_ID,assertCellResultReview} from '../src/lib/council-cell-control.ts';
assert.equal(CELL_RESULT_REVIEWER_ID,'CELL-RESULT-REVIEWER');
const sha='a'.repeat(40);
assert.doesNotThrow(()=>assertCellResultReview({
 reviewId:'REVIEW-001',reviewerId:CELL_RESULT_REVIEWER_ID,botId:'CELL-017',taskId:'TASK-001',
 planId:'PLAN-001',planVersion:1,entrySha:sha,exitSha:sha,verdict:'ACCEPT',score:92,
 criteria:{taskCompletion:95,evidenceQuality:90,planAlignment:95,correctness:90,knowledgeQuality:90},
 findings:[],evidence:['evidence://task-001'],upgradeSignals:[],
 nextAction:'RETURN_TO_POOL'
}));
assert.throws(()=>assertCellResultReview({
 reviewId:'REVIEW-002',reviewerId:'CELL-017',botId:'CELL-017',taskId:'TASK-001',planId:'PLAN-001',
 planVersion:1,entrySha:sha,exitSha:sha,verdict:'ACCEPT',score:92,
 criteria:{taskCompletion:95,evidenceQuality:90,planAlignment:95,correctness:90,knowledgeQuality:90},
 findings:[],evidence:['evidence://task-001'],upgradeSignals:[],nextAction:'RETURN_TO_POOL'
}),/CELL_RESULT_REVIEWER_ID_INVALID/);
console.log('CELL_RESULT_REVIEWER=PASS');
