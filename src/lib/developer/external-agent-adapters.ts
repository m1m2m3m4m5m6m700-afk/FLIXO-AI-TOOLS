import { EXTERNAL_AGENT_ADAPTERS } from '../agent/agent-profile.ts';

const SHA40 = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

export type ExternalAgentId = 'mini-swe-agent' | 'coderabbit';
export type ExternalAgentAction = 'LOCAL_SANDBOX_WRITE' | 'PROPOSE_PATCH' | 'REVIEW_DIFF' | 'MUTATE_REPOSITORY' | 'CREATE_BRANCH' | 'PUSH' | 'CERTIFY' | 'PROMOTE';

export type MiniSweRepairCandidate = Readonly<{ adapter:'mini-swe-agent'; role:'REPAIR_WORKER'; baseSha:string; workspaceHeadSha:string; status:'CANDIDATE'|'NO_CHANGE'|'FAILED'|'BLOCKED'; patchPath:string; patchSha256:string; changedPaths:readonly string[]; authorityBinding:'CANONICAL_CONTROL_PLANE'; mutationAuthority:false; certificationAuthority:false; branchCreation:false; directPush:false; directPromotion:false; }>;
export type CodeRabbitReviewEvidence = Readonly<{ adapter:'coderabbit'; role:'REVIEWER'; reviewedSha:string; status:'REVIEWED'|'BLOCKED'|'UNAVAILABLE'; reviewId:string; authorityBinding:'CANONICAL_CONTROL_PLANE'; mutationAuthority:false; certificationAuthority:false; branchCreation:false; directPush:false; directPromotion:false; }>;

function assertSha(value:string, code:string):void { if(!SHA40.test(value)) throw new Error(code+'='+value); }
function assertText(value:string, code:string):void { if(!value.trim()) throw new Error(code); }
function assertPatchPath(value:string):void { if(!/^artifacts\/mini-swe-agent\/[A-Za-z0-9._/-]+$/u.test(value)) throw new Error('MINI_SWE_PATCH_PATH_INVALID='+value); }

const ALLOWED_ACTIONS:Readonly<Record<ExternalAgentId,readonly ExternalAgentAction[]>> = Object.freeze({
  'mini-swe-agent': Object.freeze(['LOCAL_SANDBOX_WRITE','PROPOSE_PATCH']),
  coderabbit: Object.freeze(['REVIEW_DIFF']),
});

export function getExternalAgentAdapter(id:ExternalAgentId){ return EXTERNAL_AGENT_ADAPTERS.find((adapter)=>adapter.id===id); }

export function assertExternalAgentActionAllowed(id:ExternalAgentId, action:ExternalAgentAction):void {
  if(!getExternalAgentAdapter(id)) throw new Error('EXTERNAL_AGENT_ADAPTER_UNKNOWN='+id);
  if(!ALLOWED_ACTIONS[id].includes(action)) throw new Error('EXTERNAL_AGENT_ACTION_FORBIDDEN='+id+':'+action);
}

export function assertExactShaMatch(expectedSha:string, observedSha:string):void {
  assertSha(expectedSha,'EXTERNAL_AGENT_EXPECTED_SHA_INVALID');
  assertSha(observedSha,'EXTERNAL_AGENT_OBSERVED_SHA_INVALID');
  if(expectedSha!==observedSha) throw new Error('EXTERNAL_AGENT_STALE_SHA');
}

export function validateMiniSweRepairCandidate(candidate:MiniSweRepairCandidate, expectedSha:string):MiniSweRepairCandidate {
  assertExternalAgentActionAllowed('mini-swe-agent','PROPOSE_PATCH');
  if(candidate.adapter!=='mini-swe-agent'||candidate.role!=='REPAIR_WORKER') throw new Error('MINI_SWE_CANDIDATE_IDENTITY_INVALID');
  assertExactShaMatch(expectedSha,candidate.baseSha);
  assertSha(candidate.workspaceHeadSha,'MINI_SWE_WORKSPACE_SHA_INVALID');
  assertPatchPath(candidate.patchPath);
  if(!SHA256.test(candidate.patchSha256)) throw new Error('MINI_SWE_PATCH_DIGEST_INVALID');
  candidate.changedPaths.forEach((p)=>assertText(p,'MINI_SWE_CHANGED_PATH_INVALID'));
  if(candidate.authorityBinding!=='CANONICAL_CONTROL_PLANE') throw new Error('MINI_SWE_AUTHORITY_BINDING_INVALID');
  if(candidate.mutationAuthority||candidate.certificationAuthority||candidate.branchCreation||candidate.directPush||candidate.directPromotion) throw new Error('MINI_SWE_AUTHORITY_ESCALATION');
  if(candidate.status==='CANDIDATE'&&candidate.changedPaths.length===0) throw new Error('MINI_SWE_EMPTY_CANDIDATE');
  return Object.freeze(candidate);
}

export function validateCodeRabbitReviewEvidence(evidence:CodeRabbitReviewEvidence, expectedSha:string):CodeRabbitReviewEvidence {
  assertExternalAgentActionAllowed('coderabbit','REVIEW_DIFF');
  if(evidence.adapter!=='coderabbit'||evidence.role!=='REVIEWER') throw new Error('CODERABBIT_EVIDENCE_IDENTITY_INVALID');
  assertExactShaMatch(expectedSha,evidence.reviewedSha);
  assertText(evidence.reviewId,'CODERABBIT_REVIEW_ID_REQUIRED');
  if(evidence.authorityBinding!=='CANONICAL_CONTROL_PLANE') throw new Error('CODERABBIT_AUTHORITY_BINDING_INVALID');
  if(evidence.mutationAuthority||evidence.certificationAuthority||evidence.branchCreation||evidence.directPush||evidence.directPromotion) throw new Error('CODERABBIT_AUTHORITY_ESCALATION');
  return Object.freeze(evidence);
}
