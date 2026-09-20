#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

export const REPAIR_PROTOCOL = Object.freeze({
  schemaVersion: 1,
  protocolId: 'REPAIR_PROTOCOL',
  protocolVersion: '1.0.0',
  authority: 'CONTROL_PLANE',
  invariant: 'Every repair mutation requires protocol validation, failure capture, causal mutation, targeted retest, resume of remaining verification, final verification, and one session-scoped commit.',
  precedence: ['SYSTEM_SAFETY','REPAIR_PROTOCOL','CONTROL_PLANE','REPAIR_AGENT','INDIVIDUAL_TASK'],
  lifecycle: ['PROTOCOL_VALIDATION','FAILURE_CAPTURE','MUTATION','TARGETED_RETEST','RESUME_REMAINING_TESTS','FINAL_VERIFICATION','COMMIT_BOUNDARY'],
  inFlightFailurePolicy: 'REPAIR_IN_PLACE_THEN_TARGETED_RETEST_THEN_RESUME',
  commitPolicy: 'ONE_COMMIT_PER_COMPLETED_REPAIR_SESSION',
  additionalCommitPolicy: 'ONLY_FOR_PROVEN_INDEPENDENT_BOUNDARY',
  bypassPolicy: 'BLOCK',
  fallbackMutationPolicy: Object.freeze({ actor: 'assistantRepairAgent', minConfidence: 0.90, minSupport: 2 }),
  mutationRequires: ['protocolVersion','protocolHash','repairSessionId','failureFingerprint','targetSHA','beforeState'],
  completionRequires: ['repairAttempts','retestResult','resumePoint','finalVerification','finalSHA'],
  protectedPaths: ['scripts/ci/repair-protocol.mjs','scripts/ci/control-plane-registry.mjs','scripts/ci/auto-repair-engine.mjs','scripts/ci/auto-repair-policy.mjs','scripts/ci/agent-execution-control.mjs','.github/workflows/auto-repair.yml','scripts/ci/validate-agent-protocol.mjs'],
  mutationAgents: ['repairAgent','executionAgent','assistantRepairAgent'],
  allAgents: ['assistantController','analysis','implementation','verification','release','codeScout','executionAgent','reviewAgent','testAgent','securityAgent','performanceAgent','certificationAuthority','taskAgent','errorAgent','repairAgent','assistantRepairAgent','diagnosticAgent'],
});
export const REPAIR_PROTOCOL_HASH=createHash('sha256').update(JSON.stringify(REPAIR_PROTOCOL),'utf8').digest('hex');
const shaOk=v=>typeof v==='string'&&/^[a-f0-9]{40}$/u.test(v);
const protocolOk=v=>v?.protocolId===REPAIR_PROTOCOL.protocolId&&v?.protocolVersion===REPAIR_PROTOCOL.protocolVersion&&v?.protocolHash===REPAIR_PROTOCOL_HASH;

export function assertProtocolDefinition(){
  if(REPAIR_PROTOCOL_HASH.length!==64) throw new Error('REPAIR_PROTOCOL_HASH_INVALID');
  if(REPAIR_PROTOCOL.protocolVersion!=='1.0.0') throw new Error('REPAIR_PROTOCOL_VERSION_INVALID');
  if(REPAIR_PROTOCOL.bypassPolicy!=='BLOCK') throw new Error('REPAIR_PROTOCOL_BYPASS_POLICY_DRIFT');
  if(REPAIR_PROTOCOL.commitPolicy!=='ONE_COMMIT_PER_COMPLETED_REPAIR_SESSION') throw new Error('REPAIR_PROTOCOL_COMMIT_POLICY_DRIFT');
  return Object.freeze({protocolId:REPAIR_PROTOCOL.protocolId,protocolVersion:REPAIR_PROTOCOL.protocolVersion,protocolHash:REPAIR_PROTOCOL_HASH});
}
export function assertAgentAdmission({actor,branch='execution',mutation=false,session=null}={}){
  const protocol=assertProtocolDefinition();
  if(!REPAIR_PROTOCOL.allAgents.includes(actor)) throw new Error('REPAIR_PROTOCOL_UNKNOWN_AGENT='+actor);
  if(mutation&&!REPAIR_PROTOCOL.mutationAgents.includes(actor)) throw new Error('REPAIR_PROTOCOL_MUTATION_ROLE_BLOCKED='+actor);
  if(mutation&&branch!=='execution') throw new Error('REPAIR_PROTOCOL_MUTATION_BRANCH_BLOCKED');
  if(mutation&&!protocolOk(session)) throw new Error('REPAIR_PROTOCOL_SESSION_REQUIRED');
  if(mutation&&!['FAILURE_CAPTURED','MUTATION_AUTHORIZED'].includes(session.state)) throw new Error('REPAIR_PROTOCOL_MUTATION_STATE_BLOCKED');
  if(mutation&&actor==='assistantRepairAgent') {
    const fallback=session?.fallback;
    if(!fallback?.primaryAgentsUnavailable) throw new Error('REPAIR_PROTOCOL_FALLBACK_PRIMARY_AGENT_AVAILABLE');
    if(fallback.actor!=='assistantRepairAgent') throw new Error('REPAIR_PROTOCOL_FALLBACK_ACTOR_INVALID');
    if(!fallback.learnedRule||Number(fallback.learnedRuleConfidence??0)<REPAIR_PROTOCOL.fallbackMutationPolicy.minConfidence||Number(fallback.learnedRuleSupport??0)<REPAIR_PROTOCOL.fallbackMutationPolicy.minSupport) throw new Error('REPAIR_PROTOCOL_FALLBACK_LEARNING_THRESHOLD');
    if(fallback.targetSha!==session.targetSHA||!shaOk(fallback.targetSha)) throw new Error('REPAIR_PROTOCOL_FALLBACK_SHA_MISMATCH');
  }
  return Object.freeze({actor,branch,mutation,protocol,admitted:true});
}
export function createRepairSession({repairSessionId,actor='repairAgent',failureFingerprint,targetSHA,beforeState={worktree:'clean'},attempt=1,fallback=null}={}){
  assertAgentAdmission({actor,branch:'execution',mutation:false});
  if(!String(repairSessionId??'').trim()) throw new Error('REPAIR_PROTOCOL_SESSION_ID_REQUIRED');
  if(!failureFingerprint) throw new Error('REPAIR_PROTOCOL_FAILURE_FINGERPRINT_REQUIRED');
  if(!shaOk(targetSHA)) throw new Error('REPAIR_PROTOCOL_TARGET_SHA_INVALID');
  return Object.freeze({schemaVersion:1,protocolId:REPAIR_PROTOCOL.protocolId,protocolVersion:REPAIR_PROTOCOL.protocolVersion,protocolHash:REPAIR_PROTOCOL_HASH,repairSessionId:String(repairSessionId),actor,state:'PROTOCOL_VALIDATED',failureFingerprint:String(failureFingerprint),targetSHA,beforeState:{...beforeState},repairAttempts:Math.max(1,Number(attempt)||1),retestResult:null,resumePoint:null,finalVerification:null,finalSHA:null,commitCount:0,fallback});
}
export function captureFailure(session,evidence={}){
  if(!protocolOk(session)) throw new Error('REPAIR_PROTOCOL_SESSION_INVALID');
  if(!['PROTOCOL_VALIDATED','FAILURE_CAPTURED'].includes(session.state)) throw new Error('REPAIR_PROTOCOL_FAILURE_CAPTURE_OUT_OF_ORDER');
  return Object.freeze({...session,state:'FAILURE_CAPTURED',failureCapture:{fingerprint:session.failureFingerprint,exactSHA:session.targetSHA,evidence}});
}
export function authorizeMutation(session){return Object.freeze({...captureFailure(session,session.failureCapture?.evidence??{}),state:'MUTATION_AUTHORIZED'});}
export function completeRepairSession(session,{retestResult,resumePoint,finalVerification,finalSHA=null}={}){
  if(!protocolOk(session)) throw new Error('REPAIR_PROTOCOL_SESSION_INVALID');
  if(!['FAILURE_CAPTURED','MUTATION_AUTHORIZED'].includes(session.state)) throw new Error('REPAIR_PROTOCOL_COMPLETION_STATE_BLOCKED');
  if(retestResult!==true) throw new Error('REPAIR_PROTOCOL_RETEST_REQUIRED');
  if(!resumePoint) throw new Error('REPAIR_PROTOCOL_RESUME_POINT_REQUIRED');
  if(!finalVerification?.targetedRetest||!finalVerification?.recurrence||!finalVerification?.regression) throw new Error('REPAIR_PROTOCOL_FINAL_VERIFICATION_INCOMPLETE');
  return Object.freeze({...session,state:'COMMIT_PENDING',retestResult:true,resumePoint:String(resumePoint),finalVerification:{...finalVerification},finalSHA:shaOk(finalSHA)?finalSHA:null,commitCount:0});
}
export function validateCommitBoundary({evidence,branch='execution',headSHA,changedPaths=[]}={}){
  assertProtocolDefinition();
  const p=evidence?.repairProtocol;
  if(branch!=='execution') throw new Error('REPAIR_PROTOCOL_COMMIT_BRANCH_BLOCKED');
  if(!protocolOk(p)) throw new Error('REPAIR_PROTOCOL_EVIDENCE_MISSING');
  if(p.state!=='COMMIT_PENDING') throw new Error('REPAIR_PROTOCOL_COMMIT_STATE_BLOCKED');
  if(p.commitCount!==0) throw new Error('REPAIR_PROTOCOL_MULTIPLE_COMMIT_VIOLATION');
  if(!shaOk(headSHA)||headSHA!==p.targetSHA) throw new Error('REPAIR_PROTOCOL_TARGET_SHA_DRIFT');
  const changed=[...new Set(changedPaths.map(String).filter(Boolean))];
  if(!changed.length) throw new Error('REPAIR_PROTOCOL_EMPTY_REPAIR_BLOCKED');
  const protectedPath=changed.find(f=>REPAIR_PROTOCOL.protectedPaths.includes(f));
  if(protectedPath) throw new Error('REPAIR_PROTOCOL_SELF_MUTATION_BLOCKED='+protectedPath);
  return Object.freeze({ok:true,repairSessionId:p.repairSessionId,protocolVersion:p.protocolVersion,protocolHash:p.protocolHash,oneCommitOnly:true,changedPaths:changed});
}
export function validatePostCommitBoundary({evidence,branch='execution',parentSHA,executionSHA,commitCount}={}){
  const p=evidence?.repairProtocol;
  if(!protocolOk(p)) throw new Error('REPAIR_PROTOCOL_EVIDENCE_MISSING');
  if(branch!=='execution') throw new Error('REPAIR_PROTOCOL_POST_COMMIT_BRANCH_BLOCKED');
  if(!shaOk(parentSHA)||parentSHA!==p.targetSHA) throw new Error('REPAIR_PROTOCOL_PARENT_SHA_MISMATCH');
  if(!shaOk(executionSHA)||executionSHA===parentSHA) throw new Error('REPAIR_PROTOCOL_EXECUTION_SHA_INVALID');
  if(Number(commitCount)!==1) throw new Error('REPAIR_PROTOCOL_EXPECTS_ONE_COMMIT');
  return Object.freeze({...p,state:'COMMITTED',finalSHA:executionSHA,commitCount:1,resumePoint:'CANONICAL_CI_ON_FINAL_SHA'});
}
export function persistPostCommitEvidence(file,evidence,boundary){fs.writeFileSync(file,JSON.stringify({...evidence,repairProtocol:boundary},null,2)+'\n');}
const arg=name=>{const t=process.argv.find(v=>v.startsWith('--'+name+'='));return t?t.slice(name.length+3):'';};
if(process.argv[1]?.endsWith('/repair-protocol.mjs')){
  try{
    const command=process.argv[2]??'validate'; assertProtocolDefinition();
    if(command==='validate') console.log(JSON.stringify({status:'PASS',...assertProtocolDefinition(),lifecycle:REPAIR_PROTOCOL.lifecycle},null,2));
    else if(command==='commit-gate'){
      const evidence=JSON.parse(fs.readFileSync(arg('evidence'),'utf8')); const branch=execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(); const headSHA=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(); const changedPaths=execFileSync('git',['diff','--name-only'],{encoding:'utf8'}).trim().split(/\r?\n/u).filter(Boolean); console.log(JSON.stringify(validateCommitBoundary({evidence,branch,headSHA,changedPaths}),null,2));
    }else if(command==='post-commit'){
      const file=arg('evidence'); const evidence=JSON.parse(fs.readFileSync(file,'utf8')); const executionSHA=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(); const parentSHA=execFileSync('git',['rev-parse','HEAD^'],{encoding:'utf8'}).trim(); const count=execFileSync('git',['rev-list','--count',parentSHA+'..'+executionSHA],{encoding:'utf8'}).trim(); const boundary=validatePostCommitBoundary({evidence,branch:execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),parentSHA,executionSHA,commitCount:Number(count)}); persistPostCommitEvidence(file,evidence,boundary); console.log(JSON.stringify({status:'PASS',repairProtocol:boundary},null,2));
    }else throw new Error('Usage: repair-protocol.mjs validate|commit-gate|post-commit');
  }catch(error){console.error('REPAIR_PROTOCOL_BLOCK='+String(error?.message??error));process.exit(1);}
}
