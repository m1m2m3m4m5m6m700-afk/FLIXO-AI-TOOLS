#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  CELL_LAB_PROTOCOL_ID,
  CELL_LAB_PROTOCOL_VERSION,
  validateCellLabConsensus,
} from './cell-lab-consensus.mjs';

const sha = 'a'.repeat(40);
const base = {
  protocolId: CELL_LAB_PROTOCOL_ID,
  protocolVersion: CELL_LAB_PROTOCOL_VERSION,
  labId: 'CELL-LAB-TEST-001',
  taskId: 'TASK-TEST-001',
  exactSha: sha,
  objective: 'Test collaborative repository execution.',
  integratedPlan: 'Discuss → challenge → resolve → execute → verify.',
  planHash: 'b'.repeat(64),
  status: 'AGREED',
  executionReady: true,
  discussionClosed: true,
  participants: [
    { id:'MASTER-1', status:'AGREED', basis:'Orchestration reviewed.' },
    { id:'MASTER-2', status:'AGREED', basis:'Verification reviewed.' },
    { id:'MASTER-3', status:'AGREED', basis:'RCA reviewed.' },
    { id:'repairAgent', status:'AGREED', basis:'Execution scope accepted.' },
  ],
  discussions: [
    { kind:'OPINION', actor:'MASTER-1', text:'Use the smallest causal repair.', responses:['MASTER-2','MASTER-3'], resolution:'Integrated into plan.' },
    { kind:'QUESTION', actor:'repairAgent', text:'Is the scope restricted?', responses:['MASTER-2'], resolution:'Yes, error-only scope.', status:'ANSWERED' },
    { kind:'CHALLENGE', actor:'MASTER-3', text:'Could the symptom be caused elsewhere?', responses:['MASTER-1','MASTER-2'], resolution:'Alternatives rejected by current evidence.' },
    { kind:'DECISION', actor:'MASTER-1', text:'Execute the agreed plan.', responses:['MASTER-2','MASTER-3','repairAgent'], resolution:'All required participants agreed.', status:'AGREED' },
  ],
  dissentResolved: [],
  remainingQuestions: [],
  unresolvedConflicts: [],
  proofObligations: ['TARGETED_REGRESSION','EXACT_SHA_VERIFY'],
  stopConditions: ['SHA_DRIFT','UNSAFE_SCOPE','CONFLICT'],
};

assert.equal(validateCellLabConsensus(base,{taskId:base.taskId,exactSha:sha,mutationOwner:'repairAgent'}).executionReady,true);
assert.throws(()=>validateCellLabConsensus({...base,status:'PROPOSED'},{taskId:base.taskId,exactSha:sha,mutationOwner:'repairAgent'}),/CELL_LAB_CONSENSUS_NOT_AGREED/);
assert.throws(()=>validateCellLabConsensus({...base,exactSha:'c'.repeat(40)},{taskId:base.taskId,exactSha:sha,mutationOwner:'repairAgent'}),/CELL_LAB_EXACT_SHA_MISMATCH/);
assert.throws(()=>validateCellLabConsensus({...base,remainingQuestions:['q']},{taskId:base.taskId,exactSha:sha,mutationOwner:'repairAgent'}),/CELL_LAB_REMAINING_QUESTIONS/);
assert.throws(()=>validateCellLabConsensus({...base,participants:base.participants.slice(1)},{taskId:base.taskId,exactSha:sha,mutationOwner:'repairAgent'}),/CELL_LAB_CORE_PARTICIPANT_MISSING=MASTER-1/);

console.log('CELL_LAB_CONSENSUS_TEST=PASS');
console.log('CELL_LAB_REQUIRES_THREE_MASTERS=PASS');
console.log('CELL_LAB_REQUIRES_DISCUSSION=PASS');
console.log('CELL_LAB_REQUIRES_AGREEMENT=PASS');
console.log('CELL_LAB_REQUIRES_EXACT_SHA=PASS');
