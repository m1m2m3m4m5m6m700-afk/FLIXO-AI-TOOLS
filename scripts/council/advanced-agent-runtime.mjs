#!/usr/bin/env node
export const ADVANCED_AGENT_RUNTIME_VERSION=1;

export const COGNITION_TIERS=Object.freeze({
  STANDARD:'STANDARD',
  ADVANCED:'ADVANCED',
  ADVERSARIAL:'ADVERSARIAL',
});

export const ADVANCED_PHASES=Object.freeze([
  'INTAKE',
  'CONTEXT_RETRIEVAL',
  'PLAN',
  'EXECUTE',
  'SELF_CHECK',
  'INDEPENDENT_REVIEW',
  'VERIFY',
  'LEARN',
]);

const SHA=/^[0-9a-f]{40}$/u;
const GRADE_SCORE={E0:0,E1:10,E2:25,E3:50,E4:75,E5:100};

const required=(v,n)=>{if(typeof v!=='string'||!v.trim())throw new Error('ADVANCED_AGENT_REQUIRED_'+n.toUpperCase())};
const arr=(v,n)=>{if(!Array.isArray(v))throw new Error('ADVANCED_AGENT_'+n.toUpperCase()+'_ARRAY_REQUIRED')};

export function buildAdvancedAgentEnvelope({
  accountId,
  profileId,
  exactSha,
  missionId,
  workPackageId,
  taskId,
  role,
  objective,
  requiredCapabilities=[],
  evidenceGradeMinimum='E3',
  toolBudget=12,
  maxReasoningLoops=3,
}={}){
  for(const [v,n] of [[accountId,'account_id'],[profileId,'profile_id'],[missionId,'mission_id'],[workPackageId,'work_package_id'],[taskId,'task_id'],[role,'role'],[objective,'objective']])required(v,n);
  if(!SHA.test(String(exactSha??'')))throw new Error('ADVANCED_AGENT_EXACT_SHA_INVALID');
  if(!Array.isArray(requiredCapabilities))throw new Error('ADVANCED_AGENT_CAPABILITIES_INVALID');
  if(!GRADE_SCORE.hasOwnProperty(evidenceGradeMinimum))throw new Error('ADVANCED_AGENT_EVIDENCE_GRADE_INVALID');
  if(!Number.isInteger(toolBudget)||toolBudget<1||toolBudget>100)throw new Error('ADVANCED_AGENT_TOOL_BUDGET_INVALID');
  if(!Number.isInteger(maxReasoningLoops)||maxReasoningLoops<1||maxReasoningLoops>7)throw new Error('ADVANCED_AGENT_REASONING_LOOPS_INVALID');
  return Object.freeze({
    protocol:'FLIXO_ADVANCED_AGENT_RUNTIME_V1',
    runtimeVersion:ADVANCED_AGENT_RUNTIME_VERSION,
    accountId,profileId,exactSha,missionId,workPackageId,taskId,role,objective,
    cognitionTier:role==='ADVERSARIAL_ACTION_REPAIR'?COGNITION_TIERS.ADVERSARIAL:COGNITION_TIERS.ADVANCED,
    phases:ADVANCED_PHASES,
    requiredCapabilities:[...requiredCapabilities],
    evidenceGradeMinimum,
    toolBudget,
    maxReasoningLoops,
    controls:{
      exactShaBound:true,
      evidenceFirst:true,
      selfCritiqueRequired:true,
      independentReviewRequired:accountId!=='CHIEF',
      noSelfApproval:true,
      noCertificationClaim:true,
      failClosedOnUnknowns:true,
      conciseDecisionTraceOnly:true,
    },
  });
}

export function validateAdvancedAgentResult({
  envelope,
  result,
}={}){
  if(!envelope||envelope.protocol!=='FLIXO_ADVANCED_AGENT_RUNTIME_V1')throw new Error('ADVANCED_AGENT_ENVELOPE_INVALID');
  if(!result||typeof result!=='object'||Array.isArray(result))throw new Error('ADVANCED_AGENT_RESULT_INVALID');
  if(String(result.exactSha??'')!==envelope.exactSha)throw new Error('ADVANCED_AGENT_RESULT_STALE_SHA');
  if(String(result.profileId??'')!==envelope.profileId)throw new Error('ADVANCED_AGENT_RESULT_PROFILE_MISMATCH');
  for(const [v,n] of [
    [result.planSummary,'plan_summary'],
    [result.decision,'decision'],
    [result.verification,'verification'],
    [result.selfCritique,'self_critique'],
    [result.decisionTrace,'decision_trace'],
    [result.nextAction,'next_action'],
  ])required(v,n);
  for(const [v,n] of [
    [result.findings,'findings'],
    [result.evidence,'evidence'],
    [result.unknowns,'unknowns'],
    [result.alternativesConsidered,'alternatives_considered'],
  ])arr(v,n);
  if(!GRADE_SCORE.hasOwnProperty(String(result.evidenceGrade??'')))throw new Error('ADVANCED_AGENT_RESULT_EVIDENCE_GRADE_INVALID');
  if(GRADE_SCORE[String(result.evidenceGrade)]<GRADE_SCORE[envelope.evidenceGradeMinimum])throw new Error('ADVANCED_AGENT_RESULT_EVIDENCE_BELOW_MINIMUM');
  if(result.selfApproved===true)throw new Error('ADVANCED_AGENT_RESULT_SELF_APPROVAL_FORBIDDEN');
  if(result.certificationDecision)throw new Error('ADVANCED_AGENT_RESULT_CERTIFICATION_FORBIDDEN');
  if(result.verificationPassed!==true && result.decision==='ACCEPT')throw new Error('ADVANCED_AGENT_ACCEPT_WITHOUT_VERIFICATION');
  if(envelope.controls.failClosedOnUnknowns && result.unknowns.length>0 && result.decision==='ACCEPT')throw new Error('ADVANCED_AGENT_ACCEPT_WITH_UNRESOLVED_UNKNOWNS');
  if(envelope.controls.independentReviewRequired && result.reviewRequired!==true)throw new Error('ADVANCED_AGENT_REVIEW_REQUIRED');
  return Object.freeze({
    valid:true,
    cognitionTier:envelope.cognitionTier,
    exactSha:envelope.exactSha,
    evidenceGrade:result.evidenceGrade,
    verificationPassed:result.verificationPassed===true,
    reviewRequired:envelope.controls.independentReviewRequired,
    unresolvedUnknowns:result.unknowns.length,
  });
}

export function scoreAdvancedAgentEvidence({evidenceGrade='E0',verificationPassed=false,unknownCount=0,selfCritiquePassed=false,reviewApproved=false}={}){
  const evidence=GRADE_SCORE[String(evidenceGrade)]??0;
  const verification=verificationPassed?25:0;
  const critique=selfCritiquePassed?10:0;
  const review=reviewApproved?15:0;
  const uncertaintyPenalty=Math.min(40,Math.max(0,Number(unknownCount)||0)*8);
  return Math.max(0,Math.min(100,Math.round(evidence*.5+verification+critique+review-uncertaintyPenalty)));
}
