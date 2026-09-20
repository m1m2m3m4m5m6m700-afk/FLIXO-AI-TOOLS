#!/usr/bin/env node
import { buildAdvancedAgentEnvelope, validateAdvancedAgentResult, scoreAdvancedAgentEvidence } from './advanced-agent-runtime.mjs';

export const FRONTIER_RUNTIME_VERSION=1;
export const FRONTIER_PROTOCOL='FLIXO_FRONTIER_SPECIALIST_RUNTIME_V1';
export const FRONTIER_TIERS=Object.freeze({
  SPECIALIST:'FRONTIER_SPECIALIST',
  ADVERSARIAL:'FRONTIER_ADVERSARIAL',
});
export const FRONTIER_PHASES=Object.freeze([
  'INTAKE','MEMORY_RETRIEVAL','CONTEXT_GRAPH','HYPOTHESIS_COMPETITION','PLAN',
  'TOOL_LOOP','SIMULATION','EXECUTE','COUNTEREXAMPLE_SEARCH','SELF_CRITIQUE',
  'INDEPENDENT_REVIEW','VERIFY','LEARN',
]);
const GRADE={E0:0,E1:10,E2:25,E3:50,E4:75,E5:100};
const req=(v,n)=>{if(typeof v!=='string'||!v.trim())throw new Error('FRONTIER_AGENT_REQUIRED_'+n.toUpperCase())};
const arr=(v,n)=>{if(!Array.isArray(v))throw new Error('FRONTIER_AGENT_'+n.toUpperCase()+'_ARRAY_REQUIRED')};

export function buildFrontierCognitionEnvelope({
  accountId,profileId,exactSha,missionId,workPackageId,taskId,role,objective,
  tier=FRONTIER_TIERS.SPECIALIST,requiredCapabilities=[],evidenceGradeMinimum='E4',
  toolBudget=32,maxReasoningLoops=7,maxHypotheses=5,
}={}) {
  const base=buildAdvancedAgentEnvelope({
    accountId,profileId,exactSha,missionId,workPackageId,taskId,role,objective,
    requiredCapabilities,evidenceGradeMinimum,toolBudget,maxReasoningLoops,
  });
  if(!Object.values(FRONTIER_TIERS).includes(tier))throw new Error('FRONTIER_AGENT_TIER_INVALID');
  if(!Number.isInteger(maxHypotheses)||maxHypotheses<2||maxHypotheses>8)throw new Error('FRONTIER_AGENT_HYPOTHESIS_BUDGET_INVALID');
  return Object.freeze({
    ...base,protocol:FRONTIER_PROTOCOL,frontierRuntimeVersion:FRONTIER_RUNTIME_VERSION,
    cognitionTier:tier,phases:FRONTIER_PHASES,maxHypotheses,
    reasoningPolicy:{
      adaptiveBudget:true,minimumEvidenceGrade:evidenceGradeMinimum,toolBudget,maxReasoningLoops,
      hypothesisCompetition:true,counterexampleSearch:true,preMutationSimulation:true,memoryFirst:true,
    },
  });
}

export function validateFrontierAgentResult({envelope,result}={}) {
  if(!envelope||envelope.protocol!==FRONTIER_PROTOCOL)throw new Error('FRONTIER_AGENT_ENVELOPE_INVALID');
  validateAdvancedAgentResult({envelope:{...envelope,protocol:'FLIXO_ADVANCED_AGENT_RUNTIME_V1'},result});
  for(const [v,n] of [[result.hypotheses,'hypotheses'],[result.counterexamples,'counterexamples'],[result.toolTrace,'tool_trace'],[result.memoryReferences,'memory_references']])arr(v,n);
  req(result.selectedHypothesis,'selected_hypothesis');
  req(result.simulationSummary,'simulation_summary');
  req(result.uncertaintySummary,'uncertainty_summary');
  if(result.hypotheses.length<2)throw new Error('FRONTIER_AGENT_HYPOTHESIS_COMPETITION_REQUIRED');
  if(result.hypotheses.length>envelope.maxHypotheses)throw new Error('FRONTIER_AGENT_HYPOTHESIS_BUDGET_EXCEEDED');
  if(result.toolTrace.length<1)throw new Error('FRONTIER_AGENT_TOOL_TRACE_REQUIRED');
  if(result.memoryReferences.length<1)throw new Error('FRONTIER_AGENT_MEMORY_RETRIEVAL_REQUIRED');
  if(result.simulationPassed!==true)throw new Error('FRONTIER_AGENT_SIMULATION_REQUIRED');
  if(result.counterexamples.length<1)throw new Error('FRONTIER_AGENT_COUNTEREXAMPLE_SEARCH_REQUIRED');
  if(result.reviewRequired!==true)throw new Error('FRONTIER_AGENT_INDEPENDENT_REVIEW_REQUIRED');
  if(result.uncertaintyAcknowledged!==true)throw new Error('FRONTIER_AGENT_UNCERTAINTY_DISCLOSURE_REQUIRED');
  if(result.decision==='ACCEPT'&&result.unknowns.length>0)throw new Error('FRONTIER_AGENT_ACCEPT_WITH_UNRESOLVED_UNKNOWNS');
  return Object.freeze({
    valid:true,exactSha:envelope.exactSha,cognitionTier:envelope.cognitionTier,
    evidenceGrade:result.evidenceGrade,hypothesisCount:result.hypotheses.length,
    toolCount:result.toolTrace.length,memoryReferenceCount:result.memoryReferences.length,
    counterexampleCount:result.counterexamples.length,
  });
}

export function scoreFrontierEvidence({
  evidenceGrade='E0',verificationPassed=false,simulationPassed=false,selfCritiquePassed=false,
  reviewApproved=false,unknownCount=0,hypothesisCount=0,toolCount=0,counterexampleCount=0,memoryReferenceCount=0,
}={}) {
  const base=scoreAdvancedAgentEvidence({evidenceGrade,verificationPassed,unknownCount,selfCritiquePassed,reviewApproved});
  const diversity=Math.min(15,Math.max(0,hypothesisCount-1)*3);
  const toolDepth=Math.min(10,Math.max(0,toolCount)*1.5);
  const counterexample=Math.min(10,Math.max(0,counterexampleCount)*2);
  const memory=Math.min(5,Math.max(0,memoryReferenceCount));
  const simulation=simulationPassed?10:0;
  return Math.max(0,Math.min(100,Math.round(base*.55+diversity+toolDepth+counterexample+memory+simulation)));
}
