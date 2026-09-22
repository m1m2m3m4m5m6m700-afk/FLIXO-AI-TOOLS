#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { verifyExecutionHeadAuthority } from './execution-head-authority.mjs';
import { execFileSync as nodeExecFileSync } from 'node:child_process';

const ROOT=process.cwd();
const SHA_RE=/^[a-f0-9]{40}$/u;
const HASH_RE=/^[a-f0-9]{64}$/u;
const normalize=(v)=>String(v??'').trim().replaceAll('\\','/').replace(/^\.\//,'');
const git=(args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const hash=(v)=>crypto.createHash('sha256').update(String(v),'utf8').digest('hex');
const assertSha=(v,label)=>{const x=String(v??'').trim();if(!SHA_RE.test(x))throw new Error('MUTATION_GATE_'+label+'_INVALID');return x;};
export const scopeHash=(paths)=>hash(JSON.stringify([...new Set((paths??[]).map(normalize).filter(Boolean))].sort()));
export const fencingToken=({ownerAgent,runId,runAttempt,targetSha,workPackageId,taskId,scopeDigest})=>hash(JSON.stringify({ownerAgent:String(ownerAgent),runId:String(runId),runAttempt:String(runAttempt),targetSha:String(targetSha),workPackageId:String(workPackageId),taskId:String(taskId),scopeDigest:String(scopeDigest)}));
function argsMap(rest){const m=new Map();for(let i=0;i<rest.length;i+=1){const t=rest[i];if(!t.startsWith('--'))continue;const eq=t.indexOf('=');m.set(t.slice(2,eq<0?undefined:eq),eq<0?(rest[i+1]??''):t.slice(eq+1));}return m;}
const arg=(m,n,f='')=>String(m.get(n)??f).trim();
export function remoteExecutionSha(){
  const mocked=String(process.env.FLIXO_MUTATION_GATE_REMOTE_SHA??'').trim();
  if(mocked){ if(!trustedLocalTestHarness())throw new Error('MUTATION_GATE_REMOTE_SHA_OVERRIDE_FORBIDDEN'); return assertSha(mocked,'REMOTE_SHA'); }
  const repo=String(process.env.GITHUB_REPOSITORY??'').trim();
  if(!repo)throw new Error('MUTATION_GATE_GITHUB_REPOSITORY_MISSING');
  return assertSha(execFileSync('gh',['api',`repos/${repo}/git/ref/heads/execution`,'--jq','.object.sha'],{cwd:ROOT,encoding:'utf8'}),'REMOTE_SHA');
}
const STRICT_MUTATION_OWNERS = new Set(['AUTO_REPAIR_BOT','repairAgent','executionAgent','assistantRepairAgent','actionRepairBot']);
function centralChairStrictRequired(ownerAgent='') {
  return process.env.FLIXO_STRICT_CHAIR === 'true' || STRICT_MUTATION_OWNERS.has(String(ownerAgent ?? '').trim());
}
const trustedLocalTestHarness=()=>process.env.NODE_ENV==='test' && process.env.GITHUB_ACTIONS!=='true' && process.env.FLIXO_MUTATION_GATE_TEST_MODE==='true';
function verifyCentralChair({ownerAgent,targetSha,workPackageId,taskId}) {
  if (!centralChairStrictRequired(ownerAgent)) return { required:false, verified:false };
  if (trustedLocalTestHarness() && process.env.FLIXO_ALLOW_TEST_CHAIR_BYPASS === 'true') return { required:true, verified:false, testBypass:true };
  const leaseId=String(process.env.FLIXO_CHAIR_LEASE_ID ?? '').trim();
  const fence=String(process.env.FLIXO_CHAIR_FENCING_HASH ?? '').trim();
  const holder=String(process.env.FLIXO_CHAIR_AGENT ?? ownerAgent ?? '').trim();
  if(!leaseId||!fence||!holder) throw new Error('MUTATION_GATE_CENTRAL_CHAIR_CONTEXT_MISSING');
  nodeExecFileSync('node',['scripts/ci/central-chair-lease.mjs','verify',
    '--holder='+holder,'--task='+String(taskId),'--work-package='+String(workPackageId),
    '--sha='+String(targetSha),'--lease-id='+leaseId,'--fencing-hash='+fence],{cwd:ROOT,encoding:'utf8'});
  return { required:true, verified:true, leaseId, holder, targetSha };
}
function assertExecutionCheckout(expectedSha=null){
  if(trustedLocalTestHarness())return;
  const branch=git(['branch','--show-current']);
  if(branch==='execution')return;
  if(branch==='' && process.env.FLIXO_DETACHED_EXECUTION_TARGET==='true'){
    const expected=String(expectedSha ?? process.env.FLIXO_EXECUTION_TARGET_SHA ?? '').trim();
    if(!SHA_RE.test(expected))throw new Error('MUTATION_GATE_DETACHED_TARGET_SHA_MISSING');
    if(git(['rev-parse','HEAD'])!==expected)throw new Error('MUTATION_GATE_DETACHED_TARGET_MISMATCH');
    if(remoteExecutionSha()!==expected)throw new Error('MUTATION_GATE_DETACHED_REMOTE_HEAD_MISMATCH');
    return;
  }
  throw new Error('MUTATION_GATE_NOT_ON_EXECUTION');
}
function context({ownerAgent,targetSha,workPackageId,taskId,paths}){
  const t=assertSha(targetSha,'TARGET_SHA');const owner=String(ownerAgent??'').trim();const wp=String(workPackageId??'').trim();const task=String(taskId??'').trim();
  if(!owner||!wp||!task)throw new Error('MUTATION_GATE_CONTEXT_REQUIRED');
  const normalized=[...new Set((paths??[]).map(normalize).filter(Boolean))].sort();
  const sd=scopeHash(normalized);
  const runId=String(process.env.GITHUB_RUN_ID??'').trim();const runAttempt=String(process.env.GITHUB_RUN_ATTEMPT??'1').trim();
  if(!runId)throw new Error('MUTATION_GATE_RUN_ID_MISSING');
  return {schemaVersion:1,protocol:'FLIXO-EXECUTION-MUTATION-GATE-v1',branch:'execution',targetSha:t,ownerAgent:owner,workPackageId:wp,taskId:task,scope:normalized,scopeHash:sd,runId,runAttempt,fencingToken:fencingToken({ownerAgent:owner,runId,runAttempt,targetSha:t,workPackageId:wp,taskId:task,scopeDigest:sd}),createdAt:new Date().toISOString()};
}
export function admit({ownerAgent,targetSha,workPackageId,taskId,paths,output='/tmp/flixo-mutation-admission.json'}){
  const t=assertSha(targetSha,'TARGET_SHA');assertExecutionCheckout(t);
  if(assertSha(git(['rev-parse','HEAD']),'HEAD')!==t)throw new Error('MUTATION_GATE_STALE_LOCAL_HEAD');
  if(remoteExecutionSha()!==t)throw new Error('MUTATION_GATE_REMOTE_HEAD_CHANGED');
  const centralChair = verifyCentralChair({ownerAgent,targetSha:t,workPackageId,taskId});
  const record=context({ownerAgent,targetSha:t,workPackageId,taskId,paths});
  record.centralChair = centralChair;
  fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(record,null,2)+'\n');
  return record;
}
function readAdmission(file){if(!fs.existsSync(file))throw new Error('MUTATION_GATE_ADMISSION_MISSING');const x=JSON.parse(fs.readFileSync(file,'utf8'));if(x?.schemaVersion!==1||x?.protocol!=='FLIXO-EXECUTION-MUTATION-GATE-v1')throw new Error('MUTATION_GATE_ADMISSION_INVALID');return x;}
export function verifyAdmission({file='/tmp/flixo-mutation-admission.json',phase='pre-commit',candidateSha=null,parentSha=null}={}){
  const a=readAdmission(file);
  if (centralChairStrictRequired(a.ownerAgent)) verifyCentralChair({ownerAgent:a.ownerAgent,targetSha:a.targetSha,workPackageId:a.workPackageId,taskId:a.taskId});
  const expected=fencingToken({ownerAgent:a.ownerAgent,runId:a.runId,runAttempt:a.runAttempt,targetSha:a.targetSha,workPackageId:a.workPackageId,taskId:a.taskId,scopeDigest:a.scopeHash});
  if(expected!==a.fencingToken||!HASH_RE.test(a.fencingToken))throw new Error('MUTATION_GATE_FENCING_TOKEN_INVALID');
  if(String(process.env.GITHUB_RUN_ID??'')!==a.runId||String(process.env.GITHUB_RUN_ATTEMPT??'1')!==a.runAttempt)throw new Error('MUTATION_GATE_RUN_CONTEXT_STALE');
  if(phase==='post-push'){
    const c=assertSha(candidateSha??'','CANDIDATE_SHA');if(remoteExecutionSha()!==c)throw new Error('MUTATION_GATE_POST_PUSH_MISMATCH');verifyExecutionHeadAuthority({file:process.env.FLIXO_HEAD_AUTHORITY_PROOF ?? '/tmp/flixo-head-authority.json',targetSha:a.targetSha,parentSha:a.targetSha,candidateSha:c});return a;
  }
  if(remoteExecutionSha()!==a.targetSha)throw new Error('MUTATION_GATE_REMOTE_HEAD_CHANGED');
  if(phase==='pre-commit'){
    assertExecutionCheckout(a.targetSha);
    if(git(['rev-parse','HEAD'])!==a.targetSha)throw new Error('MUTATION_GATE_PRE_COMMIT_SHA_CHANGED');
  }else if(phase==='pre-push'){
    const c=assertSha(candidateSha??git(['rev-parse','HEAD']),'CANDIDATE_SHA');const p=parentSha?assertSha(parentSha,'PARENT_SHA'):null;
    if(git(['rev-parse','HEAD'])!==c)throw new Error('MUTATION_GATE_CANDIDATE_NOT_HEAD');
    const parents=git(['rev-list','--parents','-n','1',c]).split(/\s+/u).slice(1);
    if(!parents.includes(a.targetSha))throw new Error('MUTATION_GATE_CANDIDATE_NOT_BOUND_TO_TARGET');
    if(p&&p!==a.targetSha)throw new Error('MUTATION_GATE_PARENT_MISMATCH');
    if(c===a.targetSha)throw new Error('MUTATION_GATE_EMPTY_CANDIDATE');
    verifyExecutionHeadAuthority({file:process.env.FLIXO_HEAD_AUTHORITY_PROOF ?? '/tmp/flixo-head-authority.json',targetSha:a.targetSha,parentSha:a.targetSha,candidateSha:c});
  }else throw new Error('MUTATION_GATE_PHASE_INVALID');
  return a;
}
if(process.argv[1]?.endsWith('/execution-mutation-gate.mjs')){
  const [, , command, ...rest]=process.argv;const m=argsMap(rest);const paths=arg(m,'paths').split(',').map(normalize).filter(Boolean);
  if(command==='admit')console.log(JSON.stringify(admit({ownerAgent:arg(m,'owner'),targetSha:arg(m,'sha'),workPackageId:arg(m,'work-package'),taskId:arg(m,'task-id'),paths,output:arg(m,'output','/tmp/flixo-mutation-admission.json')}),null,2));
  else if(command==='verify')console.log(JSON.stringify(verifyAdmission({file:arg(m,'admission','/tmp/flixo-mutation-admission.json'),phase:arg(m,'phase','pre-commit'),candidateSha:arg(m,'candidate')||null,parentSha:arg(m,'parent')||null}),null,2));
  else throw new Error('Usage: execution-mutation-gate.mjs admit|verify');
}
