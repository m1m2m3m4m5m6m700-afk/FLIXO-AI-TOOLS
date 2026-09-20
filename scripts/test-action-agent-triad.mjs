#!/usr/bin/env node
import assert from 'node:assert/strict';
import {ACTION_AGENT_TRIAD_VERSION,ACTION_AGENT_ACCOUNTS,assertActionAgentDispatch,validateActionAgentResult,reliabilitySignals} from './council/action-agent-triad.mjs';
assert.equal(ACTION_AGENT_TRIAD_VERSION,1);
assert.deepEqual([...ACTION_AGENT_ACCOUNTS],['CHIEF','WORKER_A','WORKER_B']);
const sha='a'.repeat(40);
assert.equal(assertActionAgentDispatch({accountId:'WORKER_A',exactSha:sha,taskId:'TASK-001',workPackageId:'WP-001',missionId:'M-001'}).profileId,'ACTION_PRIMARY_REPAIR_V1');
assert.throws(()=>assertActionAgentDispatch({accountId:'WORKER_A',exactSha:'bad',taskId:'T',workPackageId:'W',missionId:'M'}),/ACTION_AGENT_DISPATCH_EXACT_SHA_INVALID/);
const base={profileId:'ACTION_PRIMARY_REPAIR_V1',exactSha:sha,finding:['f'],evidence:['e'],evidenceGrade:'E4',unknowns:[],lesson:'l',antiLesson:'a',skillCandidate:'s',directBenefit:'b',nextAction:'n',decisionTrace:'d',reviewRequired:true,selfApproved:false,objective:'diagnose',planSummary:'bounded plan',decision:'REVIEW',verification:'verified',selfCritique:'checked',alternativesConsidered:['alt'],verificationPassed:true,requiredCapabilities:['RCA']};
assert.equal(validateActionAgentResult({accountId:'WORKER_A',dispatch:{entry_sha:sha},status:'DONE',payload:{agentResult:base}}).valid,true);
assert.throws(()=>validateActionAgentResult({accountId:'WORKER_A',dispatch:{entry_sha:sha},status:'DONE',payload:{agentResult:{...base,selfApproved:true}}}),/ACTION_AGENT_RESULT_REVIEW_BOUNDARY_INVALID/);
assert.throws(()=>validateActionAgentResult({accountId:'WORKER_A',dispatch:{entry_sha:sha},status:'DONE',payload:{agentResult:{...base,exactSha:'b'.repeat(40)}}}),/ACTION_AGENT_RESULT_EXACT_SHA_MISMATCH/);
assert.equal(validateActionAgentResult({accountId:'WORKER_B',dispatch:{entry_sha:sha},status:'DONE',payload:{agentResult:{...base,profileId:'ACTION_ADVERSARIAL_REPAIR_V1',challenge:['challenge']}}}).role,'ADVERSARIAL_ACTION_REPAIR');
assert.equal(reliabilitySignals({status:'DONE',evidenceGrade:'E5',unknowns:[],reviewerApproved:true}).confidenceIndex,100);
assert.equal(ACTION_AGENT_PROFILES?.WORKER_A?.cognitionTier ?? 'x','ADVANCED');
console.log('ACTION_AGENT_TRIAD=PASS');
console.log('ACTION_AGENT_RESULT_GATE=PASS');
console.log('ACTION_AGENT_RELIABILITY=PASS');
