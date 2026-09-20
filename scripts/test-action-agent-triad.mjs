#!/usr/bin/env node
import assert from 'node:assert/strict';
import { ACTION_AGENT_TRIAD_VERSION, ACTION_AGENT_PROFILES, buildActionAgentCognitionEnvelope, validateActionAgentResult, scoreFrontierEvidence } from './council/action-agent-triad.mjs';

const SHA='a'.repeat(40);
for (const id of ['WORKER_A','WORKER_B']) {
  const p=ACTION_AGENT_PROFILES[id];
  assert.equal(p.cognitionTier.startsWith('FRONTIER_'), true);
  assert.equal(p.reasoningEffort, 'MAXIMUM');
  assert.equal(p.evidenceGradeMinimum, 'E4');
  assert.equal(p.toolBudget, 32);
  assert.equal(p.maxReasoningLoops, 7);
  assert.equal(p.maxHypotheses, 5);
  assert.ok(p.reasoningModes.length >= 8);
  assert.ok(p.requiredCapabilities.includes('MEMORY_RETRIEVAL'));
  assert.ok(p.requiredCapabilities.includes('SIMULATION'));
}
assert.equal(ACTION_AGENT_TRIAD_VERSION, 3);

const dispatch={entry_sha:SHA,mission_id:'M-1',work_package_id:'WP-1',task_id:'T-1'};
const envA=buildActionAgentCognitionEnvelope({accountId:'WORKER_A',dispatch,objective:'Diagnose an Actions failure'});
assert.equal(envA.protocol,'FLIXO_FRONTIER_SPECIALIST_RUNTIME_V1');
assert.equal(envA.cognitionTier,'FRONTIER_SPECIALIST');
assert.equal(envA.reasoningPolicy.hypothesisCompetition,true);
assert.equal(envA.reasoningPolicy.preMutationSimulation,true);
assert.equal(envA.reasoningPolicy.memoryFirst,true);

const base={
  profileId:'ACTION_FRONTIER_REPAIR_V2',exactSha:SHA,objective:'Diagnose',
  finding:['f'],evidence:['e'],evidenceGrade:'E5',unknowns:[],
  lesson:'l',antiLesson:'a',skillCandidate:'s',directBenefit:'b',nextAction:'n',decisionTrace:'d',
  hypotheses:['h1','h2'],selectedHypothesis:'h1',counterexamples:['c1'],toolTrace:['git','logs'],
  memoryReferences:['error-memory:F001'],simulationSummary:'simulation pass',uncertaintySummary:'bounded uncertainty',
  simulationPassed:true,verificationPassed:true,reviewRequired:true,selfApproved:false,uncertaintyAcknowledged:true,decision:'REVIEW',
  planSummary:'bounded plan',verification:'verified',selfCritique:'challenged',alternativesConsidered:['h2']
};
assert.equal(validateActionAgentResult({accountId:'WORKER_A',dispatch,status:'DONE',payload:{agentResult:base}}).valid,true);
assert.throws(()=>validateActionAgentResult({accountId:'WORKER_A',dispatch,status:'DONE',payload:{agentResult:{...base,hypotheses:['only']}}}),/FRONTIER_AGENT_HYPOTHESIS_COMPETITION_REQUIRED/);
assert.throws(()=>validateActionAgentResult({accountId:'WORKER_A',dispatch,status:'DONE',payload:{agentResult:{...base,simulationPassed:false}}}),/FRONTIER_AGENT_SIMULATION_REQUIRED/);
assert.throws(()=>validateActionAgentResult({accountId:'WORKER_A',dispatch,status:'DONE',payload:{agentResult:{...base,counterexamples:[]}}}),/FRONTIER_AGENT_COUNTEREXAMPLE_SEARCH_REQUIRED/);
assert.throws(()=>validateActionAgentResult({accountId:'WORKER_A',dispatch,status:'DONE',payload:{agentResult:{...base,memoryReferences:[]}}}),/FRONTIER_AGENT_MEMORY_RETRIEVAL_REQUIRED/);

const envB=buildActionAgentCognitionEnvelope({accountId:'WORKER_B',dispatch,objective:'Challenge diagnosis'});
assert.equal(envB.cognitionTier,'FRONTIER_ADVERSARIAL');
const bResult={...base,profileId:'ACTION_FRONTIER_ADVERSARIAL_V2',challenge:['alternative root cause'],decision:'REJECT'};
assert.equal(validateActionAgentResult({accountId:'WORKER_B',dispatch,status:'DONE',payload:{agentResult:bResult}}).valid,true);

assert.equal(scoreFrontierEvidence({
  evidenceGrade:'E5',verificationPassed:true,simulationPassed:true,selfCritiquePassed:true,
  reviewApproved:true,hypothesisCount:4,toolCount:8,counterexampleCount:3,memoryReferenceCount:2,
}),92);

console.log('ACTION_AGENT_FRONTIER_V3=PASS');
console.log('WORKER_A_FRONTIER_SPECIALIST=PASS');
console.log('WORKER_B_FRONTIER_ADVERSARIAL=PASS');
