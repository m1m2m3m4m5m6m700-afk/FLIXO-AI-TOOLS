#!/usr/bin/env node
import assert from 'node:assert/strict';
import {buildAdvancedAgentEnvelope,validateAdvancedAgentResult,scoreAdvancedAgentEvidence} from './council/advanced-agent-runtime.mjs';
const sha='a'.repeat(40);
const envelope=buildAdvancedAgentEnvelope({
 accountId:'WORKER_A',profileId:'ACTION_PRIMARY_REPAIR_V1',exactSha:sha,missionId:'M-1',workPackageId:'WP-1',taskId:'T-1',
 role:'PRIMARY_ACTION_REPAIR',objective:'Diagnose one exact-SHA Actions failure',requiredCapabilities:['RCA','EVIDENCE'],evidenceGradeMinimum:'E3'
});
assert.equal(envelope.cognitionTier,'ADVANCED');
assert.deepEqual(envelope.phases,['INTAKE','CONTEXT_RETRIEVAL','PLAN','EXECUTE','SELF_CHECK','INDEPENDENT_REVIEW','VERIFY','LEARN']);
const result={profileId:'ACTION_PRIMARY_REPAIR_V1',exactSha:sha,planSummary:'Bounded RCA then verify',decision:'REVIEW',verification:'Targeted evidence collected',selfCritique:'Checked for stale SHA and alternative cause',decisionTrace:'Selected the smallest evidence-backed action',nextAction:'Independent review',findings:['f'],evidence:['e'],unknowns:[],alternativesConsidered:['a'],evidenceGrade:'E4',verificationPassed:true,selfApproved:false,reviewRequired:true};
assert.equal(validateAdvancedAgentResult({envelope,result}).valid,true);
assert.throws(()=>validateAdvancedAgentResult({envelope,result:{...result,exactSha:'b'.repeat(40)}}),/ADVANCED_AGENT_RESULT_STALE_SHA/);
assert.throws(()=>validateAdvancedAgentResult({envelope,result:{...result,decision:'ACCEPT',verificationPassed:false}}),/ADVANCED_AGENT_ACCEPT_WITHOUT_VERIFICATION/);
assert.throws(()=>validateAdvancedAgentResult({envelope,result:{...result,decision:'ACCEPT',unknowns:['x']}}),/ADVANCED_AGENT_ACCEPT_WITH_UNRESOLVED_UNKNOWNS/);
assert.equal(scoreAdvancedAgentEvidence({evidenceGrade:'E5',verificationPassed:true,unknownCount:0,selfCritiquePassed:true,reviewApproved:true}),100);
console.log('ADVANCED_AGENT_RUNTIME=PASS');
console.log('ADVANCED_AGENT_RESULT_GATE=PASS');
console.log('ADVANCED_AGENT_EVIDENCE_SCORER=PASS');
