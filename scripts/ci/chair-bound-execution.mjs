#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const CHAIR_DEFINITIONS = Object.freeze({
  chair_1:Object.freeze({
    mode:'SINGLE_AGENT_MODE',
    permissions:Object.freeze(['FULL_EXECUTIVE_WRITE','SOURCE_MUTATION','MERGE_PROPOSAL','SINGLE_AGENT_MODE']),
    allowedPrefixes:Object.freeze(['src/','core/']),
    protectedPrefixes:Object.freeze(['.github/','scripts/ci/','schemas/','core-contracts/','.flixo/','docs/'])
  }),
  chair_2:Object.freeze({
    mode:'VERIFICATION_REPAIR_MODE',
    permissions:Object.freeze(['VERIFICATION_ONLY','FALSIFICATION','BOUNDED_REPAIR']),
    allowedPrefixes:Object.freeze(['src/','core/','tests/']),
    protectedPrefixes:Object.freeze(['.github/','scripts/ci/','schemas/','core-contracts/','.flixo/'])
  }),
  chair_3:Object.freeze({
    mode:'ARCHITECTURE_REVIEW_MODE',
    permissions:Object.freeze(['ARCHITECTURE_REVIEW','SCHEMA_VALIDATION']),
    allowedPrefixes:Object.freeze(['schemas/','core-contracts/','docs/architecture/']),
    protectedPrefixes:Object.freeze(['.github/','scripts/ci/','.flixo/'])
  })
});

const ROOT=process.cwd();
const DEFAULT_STATE=path.resolve(ROOT,'.flixo/locks/chairs.json');
const LOCK_DIR=path.resolve(ROOT,'.flixo/locks/.chair-write.lock');
const SHA_RE=/^[a-f0-9]{40}$/u;
const HASH_RE=/^[a-f0-9]{64}$/u;
const AGENT_RE=/^[A-Za-z0-9][A-Za-z0-9._:-]{0,159}$/u;

const git=(args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const sha=()=>git(['rev-parse','HEAD']);
const now=()=>new Date().toISOString();
const json=(v)=>JSON.stringify(v);
const hash=(v)=>createHash('sha256').update(String(v),'utf8').digest('hex');
const key=()=>String(process.env.FLIXO_CHAIR_SIGNING_KEY??'').trim();
const hmac=(v)=>{const k=key();if(!k)throw new Error('CHAIR_SIGNING_KEY_REQUIRED');return createHmac('sha256',k).update(v,'utf8').digest('hex');};
const statePath=()=>path.resolve(ROOT,String(process.env.FLIXO_CHAIR_STATE_PATH??DEFAULT_STATE));
const assertSha=(v,label='SHA')=>{const x=String(v??'').trim();if(!SHA_RE.test(x))throw new Error('CHAIR_'+label+'_INVALID');return x;};
const assertAgent=(v)=>{const x=String(v??'').trim();if(!AGENT_RE.test(x))throw new Error('CHAIR_AGENT_ID_INVALID');return x;};

function withWriteLock(fn){
  fs.mkdirSync(path.dirname(LOCK_DIR),{recursive:true});
  try{fs.mkdirSync(LOCK_DIR);}
  catch(error){throw new Error('CHAIR_WRITE_LOCK_BUSY',{cause:error});}
  try{return fn();}
  finally{fs.rmSync(LOCK_DIR,{recursive:true,force:true});}
}

function baseState(targetSha){
  return {
    schemaVersion:1,
    authority:'FLIXO_CHAIR_BOUND_EXECUTION',
    repository_state:'IDLE',
    idle_timestamp:now(),
    target_sha:assertSha(targetSha,'TARGET_SHA'),
    chairs:Object.fromEntries(Object.entries(CHAIR_DEFINITIONS).map(([id,def])=>[id,{
      holder_agent_id:null,status:'VACANT',permissions:[...def.permissions],acquired_at:null,target_sha:null,lease_id:null,review_id:null,scope:null
    }]))
  };
}
function readState(){
  const file=statePath();
  if(!fs.existsSync(file))throw new Error('CHAIR_STATE_MISSING');
  const value=JSON.parse(fs.readFileSync(file,'utf8'));
  validateState(value);
  return value;
}
function writeState(state){
  validateState(state);
  const file=statePath();
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+'.tmp-'+process.pid;
  fs.writeFileSync(tmp,JSON.stringify(state,null,2)+'\n');
  fs.renameSync(tmp,file);
}
function validateState(state){
  if(state?.schemaVersion!==1||state?.authority!=='FLIXO_CHAIR_BOUND_EXECUTION')throw new Error('CHAIR_STATE_HEADER_INVALID');
  assertSha(state.target_sha,'STATE_TARGET_SHA');
  if(!['IDLE','ACTIVE','STALE','LOCKED'].includes(state.repository_state))throw new Error('CHAIR_REPOSITORY_STATE_INVALID');
  for(const id of Object.keys(CHAIR_DEFINITIONS)){
    const chair=state.chairs?.[id];
    if(!chair||!['VACANT','OCCUPIED','REVOKED','STALE'].includes(chair.status))throw new Error('CHAIR_RECORD_INVALID='+id);
    if(chair.status==='OCCUPIED'){
      assertAgent(chair.holder_agent_id);
      assertSha(chair.target_sha,'CHAIR_TARGET_SHA');
      if(!HASH_RE.test(String(chair.lease_id??'')))throw new Error('CHAIR_LEASE_ID_INVALID');
      if(chair.target_sha!==state.target_sha)throw new Error('CHAIR_STATE_SHA_MISMATCH='+id);
    }
  }
  if(state.repository_state==='IDLE'&&Object.values(state.chairs).some(c=>c.status==='OCCUPIED'))throw new Error('CHAIR_IDLE_WITH_OCCUPIED');
  return true;
}
function occupied(state){return Object.entries(state.chairs).filter(([,c])=>c.status==='OCCUPIED');}
function canonicalLease({chairId,agentId,targetSha,permissions,reviewId,scope}){
  return JSON.stringify({chairId,agentId,targetSha,permissions:[...permissions],reviewId:reviewId??null,scope:scope??null});
}
export function leaseIdFor(input){return hash(canonicalLease(input));}
function signLease(input){return hmac(canonicalLease(input));}
export function initialize({targetSha=sha()}={}){
  const t=assertSha(targetSha,'TARGET_SHA');
  return withWriteLock(()=>{if(fs.existsSync(statePath())){const existing=readState();if(existing.target_sha!==t)throw new Error('CHAIR_INIT_STALE_STATE');return existing;}const state=baseState(t);writeState(state);return state;});
}
export function acquire({chairId='chair_1',agentId,targetSha=sha(),repositoryState='IDLE',reviewId=null,scope=null}={}){
  assertAgent(agentId);const t=assertSha(targetSha,'TARGET_SHA');if(t!==sha())throw new Error('STALE_CONTEXT');
  if(!CHAIR_DEFINITIONS[chairId])throw new Error('CHAIR_UNKNOWN');
  return withWriteLock(()=>{
    const state=readState();
    if(state.target_sha!==t)throw new Error('CHAIR_STATE_SHA_MISMATCH');
    const active=occupied(state);
    if(chairId==='chair_1'){
      if(repositoryState!=='IDLE'||state.repository_state!=='IDLE')throw new Error('CHAIR_REPOSITORY_NOT_IDLE');
      if(active.length)throw new Error('CHAIR_ALREADY_OCCUPIED');
    }else if(state.repository_state==='STALE'||state.repository_state==='LOCKED'){
      throw new Error('CHAIR_REPOSITORY_NOT_AVAILABLE');
    }
    const chair=state.chairs[chairId];
    if(chair.status!=='VACANT')throw new Error('CHAIR_NOT_VACANT');
    if((chairId==='chair_3')&&!reviewId)throw new Error('CHAIR3_ARCHITECTURE_REVIEW_ID_REQUIRED');
    const leaseInput={chairId,agentId,targetSha:t,permissions:CHAIR_DEFINITIONS[chairId].permissions,reviewId,scope};
    chair.holder_agent_id=agentId;chair.status='OCCUPIED';chair.acquired_at=now();chair.target_sha=t;chair.lease_id=signLease(leaseInput);chair.review_id=reviewId;chair.scope=scope;
    state.repository_state='ACTIVE';state.idle_timestamp=null;writeState(state);return state;
  });
}
function getChair(state,chairId){
  const chair=state?.chairs?.[chairId];
  if(!chair)throw new Error('CHAIR_UNKNOWN');
  if(chair.status!=='OCCUPIED')throw new Error('CHAIR_NOT_OCCUPIED');
  return chair;
}
function verifyLease({state,chairId,agentId,targetSha}){
  const t=assertSha(targetSha,'TARGET_SHA');if(t!==sha())throw new Error('STALE_CONTEXT');
  const chair=getChair(state,chairId);
  if(chair.holder_agent_id!==agentId)throw new Error('UNAUTHORIZED_EXECUTION_ATTEMPT');
  if(chair.target_sha!==t||state.target_sha!==t)throw new Error('STALE_CONTEXT');
  const input={chairId,agentId,targetSha:t,permissions:CHAIR_DEFINITIONS[chairId].permissions,reviewId:chair.review_id,scope:chair.scope};
  const expected=signLease(input);
  const supplied=String(chair.lease_id??'');
  if(!HASH_RE.test(supplied)||!timingSafeEqual(Buffer.from(expected,'utf8'),Buffer.from(supplied,'utf8')))throw new Error('CHAIR_LEASE_SIGNATURE_INVALID');
  return chair;
}
export function authorizeWrite({chairId,agentId,targetSha=sha(),paths=[],permission='SOURCE_MUTATION',reviewId=null,boundedScope=null}={}){
  if(!Array.isArray(paths)||paths.length===0)throw new Error('CHAIR_WRITE_PATHS_REQUIRED');
  const t=assertSha(targetSha,'TARGET_SHA');
  const state=readState();
  if(state.target_sha!==t)throw new Error('STALE_CONTEXT');
  const chair=verifyLease({state,chairId,agentId,targetSha:t});
  const def=CHAIR_DEFINITIONS[chairId];
  if(!def.permissions.includes(permission))throw new Error('CHAIR_PERMISSION_DENIED='+permission);
  if(chairId==='chair_1'&&permission==='MERGE_PROPOSAL')throw new Error('MERGE_PROPOSAL_IS_NOT_MERGE_AUTHORITY');
  if(['chair_2','chair_3'].includes(chairId)&&permission==='SOURCE_MUTATION'&&chairId==='chair_2'&&!boundedScope?.length)throw new Error('CHAIR2_BOUNDED_SCOPE_REQUIRED');
  if(chairId==='chair_3'&&(!reviewId||reviewId!==chair.review_id))throw new Error('CHAIR3_REVIEW_ID_MISMATCH');
  const normalized=paths.map(p=>String(p).replace(/\\\\/g,'/').replace(/^\\.\\//,''));
  if(normalized.some(p=>p.startsWith('/')||p.includes('..')))throw new Error('CHAIR_PATH_INVALID');
  for(const p of normalized){
    if(def.protectedPrefixes.some(prefix=>p===prefix||p.startsWith(prefix)))throw new Error('CHAIR_PROTECTED_PATH');
    if(!def.allowedPrefixes.some(prefix=>p.startsWith(prefix)))throw new Error('CHAIR_SCOPE_DENIED='+p);
  }
  if(chairId==='chair_2'&&permission==='SOURCE_MUTATION'&&occupied(state).some(([id])=>id==='chair_1'))throw new Error('CHAIR2_WRITE_BLOCKED_WHILE_CHAIR1_ACTIVE');
  if(chairId==='chair_2'&&permission==='SOURCE_MUTATION'){
    const scope=new Set((boundedScope??[]).map(p=>String(p).replace(/^\\.\\//,'').replace(/\\\\/g,'/')));
    if(normalized.some(p=>!scope.has(p)))throw new Error('CHAIR2_SCOPE_DRIFT');
  }
  return Object.freeze({authorized:true,chairId,agentId,targetSha:t,permission,paths:normalized,mode:def.mode,singleAgentMode:chairId==='chair_1'&&occupied(state).length===1});
}
export function authorizeMergeProposal({chairId,agentId,targetSha=sha()}={}){
  const state=readState();const chair=verifyLease({state,chairId,agentId,targetSha});
  if(!CHAIR_DEFINITIONS[chairId].permissions.includes('MERGE_PROPOSAL'))throw new Error('CHAIR_MERGE_PROPOSAL_PERMISSION_DENIED');
  return Object.freeze({authorized:true,proposalOnly:true,requiresPromotionGate:true,chairId,agentId,targetSha:chair.target_sha});
}
export function release({chairId,agentId,targetSha=sha(),successful=false}={}){
  const t=assertSha(targetSha,'TARGET_SHA');
  return withWriteLock(()=>{
    const state=readState();const chair=verifyLease({state,chairId,agentId,targetSha:t});
    chair.holder_agent_id=null;chair.status='VACANT';chair.acquired_at=null;chair.target_sha=null;chair.lease_id=null;chair.review_id=null;chair.scope=null;
    const remaining=occupied(state).length;state.repository_state=remaining===0?'IDLE':'ACTIVE';state.idle_timestamp=remaining===0?now():null;
    if(successful===true&&state.repository_state==='ACTIVE')state.repository_state='ACTIVE';
    writeState(state);return state;
  });
}
export function validateCurrent({chairId,agentId,targetSha=sha(),paths=[],permission='SOURCE_MUTATION',reviewId=null,boundedScope=null}={}){
  const t=assertSha(targetSha,'TARGET_SHA');if(t!==sha())throw new Error('STALE_CONTEXT');
  return authorizeWrite({chairId,agentId,targetSha:t,paths,permission,reviewId,boundedScope});
}
export function repositoryMode({targetSha=sha()}={}){
  const state=readState();const t=assertSha(targetSha,'TARGET_SHA');if(state.target_sha!==t)throw new Error('STALE_CONTEXT');
  return {repositoryState:state.repository_state,activeChairs:occupied(state).map(([id,c])=>({chairId:id,holderAgentId:c.holder_agent_id,targetSha:c.target_sha,mode:CHAIR_DEFINITIONS[id].mode})),singleAgentMode:occupied(state).length===1&&occupied(state).some(([id])=>id==='chair_1')};
}

if(process.argv[1]?.endsWith('/chair-bound-execution.mjs')){
  const [, , command, ...rest]=process.argv;const args=new Map();
  for(let i=0;i<rest.length;i+=1){const token=rest[i];if(!token.startsWith('--'))continue;const eq=token.indexOf('=');const k=token.slice(2,eq>=0?eq:undefined);const v=eq>=0?token.slice(eq+1):(rest[i+1]??'');args.set(k,v);}
  const arg=(n,f='')=>String(args.get(n)??f).trim();
  const paths=arg('paths').split(',').map(v=>v.trim()).filter(Boolean);
  const scope=arg('scope').split(',').map(v=>v.trim()).filter(Boolean);
  const target=arg('sha',sha());
  if(command==='init')console.log(JSON.stringify(initialize({targetSha:target}),null,2));
  else if(command==='acquire')console.log(JSON.stringify(acquire({chairId:arg('chair','chair_1'),agentId:arg('agent'),targetSha:target,repositoryState:arg('repository-state','IDLE'),reviewId:arg('review-id')||null,scope:scope.length?scope:null}),null,2));
  else if(command==='authorize-write')console.log(JSON.stringify(authorizeWrite({chairId:arg('chair','chair_1'),agentId:arg('agent'),targetSha:target,paths,permission:arg('permission','SOURCE_MUTATION'),reviewId:arg('review-id')||null,boundedScope:scope.length?scope:null}),null,2));
  else if(command==='merge-proposal')console.log(JSON.stringify(authorizeMergeProposal({chairId:arg('chair','chair_1'),agentId:arg('agent'),targetSha:target}),null,2));
  else if(command==='release')console.log(JSON.stringify(release({chairId:arg('chair','chair_1'),agentId:arg('agent'),targetSha:target,successful:arg('successful','false')==='true'}),null,2));
  else if(command==='mode')console.log(JSON.stringify(repositoryMode({targetSha:target}),null,2));
  else if(command==='validate')console.log(JSON.stringify(validateCurrent({chairId:arg('chair','chair_1'),agentId:arg('agent'),targetSha:target,paths,permission:arg('permission','SOURCE_MUTATION'),reviewId:arg('review-id')||null,boundedScope:scope.length?scope:null}),null,2));
  else throw new Error('Usage: chair-bound-execution.mjs init|acquire|authorize-write|merge-proposal|release|mode|validate');
}
