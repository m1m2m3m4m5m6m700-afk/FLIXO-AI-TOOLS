import { buildAdvancedAgentEnvelope, validateAdvancedAgentResult, scoreAdvancedAgentEvidence, COGNITION_TIERS } from './advanced-agent-runtime.mjs';
#!/usr/bin/env node
export const ACTION_AGENT_TRIAD_VERSION=2;
export const ACTION_AGENT_ACCOUNTS=Object.freeze(['CHIEF','WORKER_A','WORKER_B']);
export const ACTION_AGENT_PROFILES=Object.freeze({
 CHIEF:Object.freeze({accountId:'CHIEF',profileId:'ACTION_COMMANDER_V1',role:'ACTION_COMMANDER',cognitionTier:COGNITION_TIERS.ADVANCED,reasoningModes:Object.freeze(['PLANNING','EVIDENCE_SYNTHESIS','TOOL_SELECTION','SELF_CRITIQUE']),mutationMode:'NONE',certificationAuthority:false,canDispatchTo:Object.freeze(['WORKER_A','WORKER_B']),fallbackAccountId:'CHIEF',requiredOutput:Object.freeze(['finding','evidence','evidenceGrade','unknowns','lesson','antiLesson','skillCandidate','directBenefit','nextAction','decisionTrace'])}),
 WORKER_A:Object.freeze({accountId:'WORKER_A',profileId:'ACTION_PRIMARY_REPAIR_V1',role:'PRIMARY_ACTION_REPAIR',cognitionTier:COGNITION_TIERS.ADVANCED,reasoningModes:Object.freeze(['RCA','HYPOTHESIS_TESTING','TOOL_SELECTION','SELF_CRITIQUE','VERIFICATION']),mutationMode:'DELEGATED_REPAIR_ONLY',certificationAuthority:false,canDispatchTo:Object.freeze([]),fallbackAccountId:'WORKER_B',requiredOutput:Object.freeze(['finding','evidence','evidenceGrade','unknowns','lesson','antiLesson','skillCandidate','directBenefit','nextAction','decisionTrace'])}),
 WORKER_B:Object.freeze({accountId:'WORKER_B',profileId:'ACTION_ADVERSARIAL_REPAIR_V1',role:'ADVERSARIAL_ACTION_REPAIR',cognitionTier:COGNITION_TIERS.ADVERSARIAL,reasoningModes:Object.freeze(['RCA','FALSIFICATION','ADVERSARIAL_REVIEW','SELF_CRITIQUE','VERIFICATION']),mutationMode:'DELEGATED_REPAIR_ONLY',certificationAuthority:false,canDispatchTo:Object.freeze([]),fallbackAccountId:'WORKER_A',requiredOutput:Object.freeze(['finding','evidence','evidenceGrade','unknowns','lesson','antiLesson','skillCandidate','directBenefit','nextAction','decisionTrace','challenge'])}),
});
const SHA=/^[0-9a-f]{40}$/u; const GRADES=new Set(['E0','E1','E2','E3','E4','E5']);
const text=(v,n)=>{if(typeof v!=='string'||!v.trim())throw new Error('ACTION_AGENT_RESULT_'+n.toUpperCase()+'_REQUIRED')};
const arr=(v,n)=>{if(!Array.isArray(v))throw new Error('ACTION_AGENT_RESULT_'+n.toUpperCase()+'_ARRAY_REQUIRED')};
export const getActionAgentProfile=(id)=>{const p=ACTION_AGENT_PROFILES[String(id??'').trim().toUpperCase()];if(!p)throw new Error('ACTION_AGENT_PROFILE_UNKNOWN');return p};
export function assertActionAgentDispatch({accountId,exactSha,taskId,workPackageId,missionId}={}){
 const p=getActionAgentProfile(accountId);
 if(!SHA.test(String(exactSha??'')))throw new Error('ACTION_AGENT_DISPATCH_EXACT_SHA_INVALID');
 if(!String(taskId??'').trim())throw new Error('ACTION_AGENT_DISPATCH_TASK_REQUIRED');
 if(!String(workPackageId??'').trim())throw new Error('ACTION_AGENT_DISPATCH_WORK_PACKAGE_REQUIRED');
 if(!String(missionId??'').trim())throw new Error('ACTION_AGENT_DISPATCH_MISSION_REQUIRED');
 return p;
}
export function validateActionAgentResult({accountId,dispatch,status,payload}={}){
 const p=getActionAgentProfile(accountId);
 if(status!=='DONE'&&status!=='FAILED')throw new Error('ACTION_AGENT_RESULT_TRANSPORT_STATUS_INVALID');
 const exactSha=String(dispatch?.entry_sha??dispatch?.entrySha??'');
 if(!SHA.test(exactSha))throw new Error('ACTION_AGENT_RESULT_DISPATCH_SHA_INVALID');
 const r=payload?.agentResult??payload;
 if(!r||typeof r!=='object'||Array.isArray(r))throw new Error('ACTION_AGENT_RESULT_PAYLOAD_INVALID');
 if(String(r.profileId??'')!==p.profileId)throw new Error('ACTION_AGENT_RESULT_PROFILE_MISMATCH');
 if(String(r.exactSha??'')!==exactSha)throw new Error('ACTION_AGENT_RESULT_EXACT_SHA_MISMATCH');
 for(const f of p.requiredOutput){
   if(f==='challenge'){if(p.accountId==='WORKER_B'&&(!Array.isArray(r.challenge)||!r.challenge.length))throw new Error('ACTION_AGENT_RESULT_CHALLENGE_REQUIRED');continue}
   if(r[f]===undefined||r[f]===null)throw new Error('ACTION_AGENT_RESULT_REQUIRED_FIELD_MISSING='+f)
 }
 arr(r.finding,'finding');arr(r.evidence,'evidence');arr(r.unknowns,'unknowns');
 text(r.lesson,'lesson');text(r.antiLesson,'antiLesson');text(r.skillCandidate,'skillCandidate');text(r.directBenefit,'directBenefit');text(r.nextAction,'nextAction');text(r.decisionTrace,'decisionTrace');
 if(!GRADES.has(String(r.evidenceGrade??'')))throw new Error('ACTION_AGENT_RESULT_EVIDENCE_GRADE_INVALID');
 if(r.certificationDecision)throw new Error('ACTION_AGENT_RESULT_CANNOT_CERTIFY');
 if(r.authorityEscalation===true)throw new Error('ACTION_AGENT_RESULT_AUTHORITY_ESCALATION_FORBIDDEN');
 if(p.accountId!=='CHIEF'&&(r.reviewRequired!==true||r.selfApproved===true))throw new Error('ACTION_AGENT_RESULT_REVIEW_BOUNDARY_INVALID');
 return Object.freeze({valid:true,accountId:p.accountId,profileId:p.profileId,role:p.role,exactSha,evidenceGrade:String(r.evidenceGrade),reviewRequired:p.accountId!=='CHIEF',mutationMode:p.mutationMode});
}
export function reliabilitySignals({status='FAILED',evidenceGrade='E0',unknowns=[],reviewerApproved=false,scopeViolation=false,staleSha=false}={}){
 const g={E0:0,E1:10,E2:25,E3:50,E4:75,E5:100}[String(evidenceGrade)]??0;
 const completeness=Math.max(0,100-Math.min(100,Number(unknowns.length||0)*10));
 const s=status==='DONE'?100:20;
 return Object.freeze({evidenceScore:g,completenessScore:completeness,statusScore:s,reviewerApproved:Boolean(reviewerApproved),scopeViolation:Boolean(scopeViolation),staleSha:Boolean(staleSha),confidenceIndex:Math.max(0,Math.round(g*.45+completeness*.2+s*.2+(reviewerApproved?15:0)-(scopeViolation?60:0)-(staleSha?80:0)))});
}
