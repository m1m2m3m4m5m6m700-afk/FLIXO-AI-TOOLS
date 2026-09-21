#!/usr/bin/env node
import { buildFrontierCognitionEnvelope, validateFrontierAgentResult, scoreFrontierEvidence, FRONTIER_TIERS } from './frontier-specialist-runtime.mjs';

export const ACTION_AGENT_TRIAD_VERSION=3;
export const ACTION_AGENT_ACCOUNTS=Object.freeze(['CHIEF','WORKER_A','WORKER_B']);
export const ACTION_AGENT_PROFILES=Object.freeze({
  CHIEF:Object.freeze({
    accountId:'CHIEF',profileId:'ACTION_COMMANDER_V1',role:'ACTION_COMMANDER',
    cognitionTier:'ADVANCED',modelProfile:'FRONTIER_REASONING',reasoningEffort:'HIGH',
    mutationMode:'NONE',certificationAuthority:false,canDispatchTo:Object.freeze(['WORKER_A','WORKER_B']),
    fallbackAccountId:'CHIEF',requiredOutput:Object.freeze(['finding','evidence','evidenceGrade','unknowns','lesson','antiLesson','skillCandidate','directBenefit','nextAction','decisionTrace'])
  }),
  WORKER_A:Object.freeze({
    accountId:'WORKER_A',profileId:'ACTION_FRONTIER_REPAIR_V2',role:'PRIMARY_ACTION_REPAIR',
    cognitionTier:FRONTIER_TIERS.SPECIALIST,modelProfile:'FRONTIER_CODING_REASONING',reasoningEffort:'MAXIMUM',
    reasoningModes:Object.freeze(['RCA','HYPOTHESIS_COMPETITION','CODE_INTELLIGENCE','TOOL_SELECTION','MEMORY_RETRIEVAL','SIMULATION','SELF_CRITIQUE','VERIFICATION']),
    mutationMode:'DELEGATED_REPAIR_ONLY',certificationAuthority:false,canDispatchTo:Object.freeze([]),
    fallbackAccountId:'WORKER_B',evidenceGradeMinimum:'E4',toolBudget:32,maxReasoningLoops:7,maxHypotheses:5,
    requiredCapabilities:Object.freeze(['RCA','CODE_INTELLIGENCE','ACTION_DIAGNOSTICS','TOOL_CALLING','MEMORY_RETRIEVAL','SIMULATION','SELF_CRITIQUE','VERIFICATION']),
    requiredOutput:Object.freeze(['finding','evidence','evidenceGrade','unknowns','lesson','antiLesson','skillCandidate','directBenefit','nextAction','decisionTrace','hypotheses','selectedHypothesis','counterexamples','toolTrace','memoryReferences','simulationSummary','uncertaintySummary'])
  }),
  WORKER_B:Object.freeze({
    accountId:'WORKER_B',profileId:'ACTION_FRONTIER_ADVERSARIAL_V2',role:'ADVERSARIAL_ACTION_REPAIR',
    cognitionTier:FRONTIER_TIERS.ADVERSARIAL,modelProfile:'FRONTIER_ADVERSARIAL_REASONING',reasoningEffort:'MAXIMUM',
    reasoningModes:Object.freeze(['RCA','FALSIFICATION','RED_TEAM','HYPOTHESIS_COMPETITION','COUNTEREXAMPLE_SEARCH','TOOL_SELECTION','MEMORY_RETRIEVAL','SIMULATION','SELF_CRITIQUE','VERIFICATION']),
    mutationMode:'DELEGATED_REPAIR_ONLY',certificationAuthority:false,canDispatchTo:Object.freeze([]),
    fallbackAccountId:'WORKER_A',evidenceGradeMinimum:'E4',toolBudget:32,maxReasoningLoops:7,maxHypotheses:5,
    requiredCapabilities:Object.freeze(['RCA','FALSIFICATION','ADVERSARIAL_REVIEW','ACTION_DIAGNOSTICS','TOOL_CALLING','MEMORY_RETRIEVAL','SIMULATION','SELF_CRITIQUE','VERIFICATION']),
    requiredOutput:Object.freeze(['finding','evidence','evidenceGrade','unknowns','lesson','antiLesson','skillCandidate','directBenefit','nextAction','decisionTrace','challenge','hypotheses','selectedHypothesis','counterexamples','toolTrace','memoryReferences','simulationSummary','uncertaintySummary'])
  })
});

const SHA=/^[0-9a-f]{40}$/u;
const GRADES=new Set(['E0','E1','E2','E3','E4','E5']);
const text=(v,n)=>{if(typeof v!=='string'||!v.trim())throw new Error('ACTION_AGENT_RESULT_'+n.toUpperCase()+'_REQUIRED')};
const arr=(v,n)=>{if(!Array.isArray(v))throw new Error('ACTION_AGENT_RESULT_'+n.toUpperCase()+'_ARRAY_REQUIRED')};
export const getActionAgentProfile=(id)=>{const p=ACTION_AGENT_PROFILES[String(id??'').trim().toUpperCase()];if(!p)throw new Error('ACTION_AGENT_PROFILE_UNKNOWN');return p};

export function buildActionAgentCognitionEnvelope({accountId,dispatch,objective,requiredCapabilities=[]}={}) {
  const p=getActionAgentProfile(accountId);
  const exactSha=dispatch.entry_sha??dispatch.entrySha;
  const missionId=dispatch.mission_id??dispatch.missionId;
  const workPackageId=dispatch.work_package_id??dispatch.workPackageId;
  const taskId=dispatch.task_id??dispatch.taskId;
  if(accountId==='CHIEF') {
    return buildFrontierCognitionEnvelope({
      accountId,profileId:p.profileId,exactSha,missionId,workPackageId,taskId,role:p.role,objective,
      requiredCapabilities,evidenceGradeMinimum:'E3',toolBudget:16,maxReasoningLoops:4,maxHypotheses:3,tier:FRONTIER_TIERS.SPECIALIST
    });
  }
  return buildFrontierCognitionEnvelope({
    accountId,profileId:p.profileId,exactSha,missionId,workPackageId,taskId,role:p.role,objective,
    requiredCapabilities:requiredCapabilities.length?requiredCapabilities:p.requiredCapabilities,
    evidenceGradeMinimum:p.evidenceGradeMinimum,toolBudget:p.toolBudget,maxReasoningLoops:p.maxReasoningLoops,
    maxHypotheses:p.maxHypotheses,tier:p.cognitionTier
  });
}

export function assertActionAgentDispatch({accountId,exactSha,taskId,workPackageId,missionId}={}) {
  const p=getActionAgentProfile(accountId);
  if(!SHA.test(String(exactSha??'')))throw new Error('ACTION_AGENT_DISPATCH_EXACT_SHA_INVALID');
  if(!String(taskId??'').trim())throw new Error('ACTION_AGENT_DISPATCH_TASK_REQUIRED');
  if(!String(workPackageId??'').trim())throw new Error('ACTION_AGENT_DISPATCH_WORK_PACKAGE_REQUIRED');
  if(!String(missionId??'').trim())throw new Error('ACTION_AGENT_DISPATCH_MISSION_REQUIRED');
  return p;
}

export function validateActionAgentResult({accountId,dispatch,status,payload}={}) {
  const p=getActionAgentProfile(accountId);
  if(status!=='DONE'&&status!=='FAILED')throw new Error('ACTION_AGENT_RESULT_TRANSPORT_STATUS_INVALID');
  const exactSha=String(dispatch?.entry_sha??dispatch?.entrySha??'');
  if(!SHA.test(exactSha))throw new Error('ACTION_AGENT_RESULT_DISPATCH_SHA_INVALID');
  const r=payload?.agentResult??payload;
  if(!r||typeof r!=='object'||Array.isArray(r))throw new Error('ACTION_AGENT_RESULT_PAYLOAD_INVALID');
  if(String(r.profileId??'')!==p.profileId)throw new Error('ACTION_AGENT_RESULT_PROFILE_MISMATCH');
  if(String(r.exactSha??'')!==exactSha)throw new Error('ACTION_AGENT_RESULT_EXACT_SHA_MISMATCH');
  for(const f of p.requiredOutput){if(r[f]===undefined||r[f]===null)throw new Error('ACTION_AGENT_RESULT_REQUIRED_FIELD_MISSING='+f)}
  for(const [v,n] of [[r.finding,'finding'],[r.evidence,'evidence'],[r.unknowns,'unknowns'],[r.hypotheses,'hypotheses'],[r.counterexamples,'counterexamples'],[r.toolTrace,'toolTrace'],[r.memoryReferences,'memoryReferences']])arr(v,n);
  for(const [v,n] of [[r.lesson,'lesson'],[r.antiLesson,'antiLesson'],[r.skillCandidate,'skillCandidate'],[r.directBenefit,'directBenefit'],[r.nextAction,'nextAction'],[r.decisionTrace,'decisionTrace'],[r.selectedHypothesis,'selectedHypothesis'],[r.simulationSummary,'simulationSummary'],[r.uncertaintySummary,'uncertaintySummary']])text(v,n);
  if(!GRADES.has(String(r.evidenceGrade??'')))throw new Error('ACTION_AGENT_RESULT_EVIDENCE_GRADE_INVALID');
  if(r.certificationDecision)throw new Error('ACTION_AGENT_RESULT_CANNOT_CERTIFY');
  if(r.authorityEscalation===true)throw new Error('ACTION_AGENT_RESULT_AUTHORITY_ESCALATION_FORBIDDEN');
  if(p.accountId!=='CHIEF') {
    const frontier=buildActionAgentCognitionEnvelope({accountId,dispatch,objective:r.objective??'repair',requiredCapabilities:p.requiredCapabilities});
    validateFrontierAgentResult({envelope:frontier,result:r});
  }
  return Object.freeze({
    valid:true,accountId:p.accountId,profileId:p.profileId,role:p.role,exactSha,
    evidenceGrade:String(r.evidenceGrade),reviewRequired:p.accountId!=='CHIEF',mutationMode:p.mutationMode,cognitionTier:p.cognitionTier
  });
}

export function reliabilitySignals({status='FAILED',evidenceGrade='E0',unknowns=[],reviewerApproved=false,scopeViolation=false,staleSha=false}={}) {
  const g={E0:0,E1:10,E2:25,E3:50,E4:75,E5:100}[String(evidenceGrade)]??0;
  const completeness=Math.max(0,100-Math.min(100,Number(unknowns.length||0)*10));
  const s=status==='DONE'?100:20;
  return Object.freeze({evidenceScore:g,completenessScore:completeness,statusScore:s,reviewerApproved:Boolean(reviewerApproved),scopeViolation:Boolean(scopeViolation),staleSha:Boolean(staleSha),confidenceIndex:Math.max(0,Math.round(g*.45+completeness*.2+s*.2+(reviewerApproved?15:0)-(scopeViolation?60:0)-(staleSha?80:0)))});
}
export { scoreFrontierEvidence };
