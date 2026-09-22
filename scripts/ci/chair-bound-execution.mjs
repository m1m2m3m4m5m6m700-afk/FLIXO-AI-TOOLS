#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const CHAIR_DEFINITIONS = Object.freeze({
  chair_1:Object.freeze({
    mode:'SINGLE_AGENT_MODE',
    primaryMission:'CHAIR1_PRIMARY_TEST_CYCLE_REPAIR',
    missionContract:'Observe canonical test-cycle RED → compare current exact SHA with the latest update/base state → repair the causal direct failure → targeted retest → resume until canonical GREEN.',
    missionStopConditions:Object.freeze(['CANONICAL_GREEN','STALE_SHA','PROOF_FAILED','BLOCKED_EXTERNAL']),
    permissions:Object.freeze(['FULL_EXECUTIVE_WRITE','SOURCE_MUTATION','MERGE_PROPOSAL','SINGLE_AGENT_MODE']),
    allowedPrefixes:Object.freeze(['']),
    protectedPrefixes:Object.freeze(['.github/','scripts/ci/','schemas/','core-contracts/','.flixo/','docs/architecture/','docs/ASSISTANT-AGENT-COOPERATION-CONTRACT.json','AGENTS.md','المهام.md'])
  }),
  chair_2:Object.freeze({
    mode:'VERIFICATION_REPAIR_MODE',
    permissions:Object.freeze(['VERIFICATION_ONLY','FALSIFICATION','BOUNDED_REPAIR','PUSH_PROPOSAL']),
    allowedPrefixes:Object.freeze(['src/','core/','tests/']),
    protectedPrefixes:Object.freeze(['.github/','scripts/ci/','schemas/','core-contracts/','.flixo/'])
  }),
  chair_3:Object.freeze({
    mode:'ARCHITECTURE_REVIEW_MODE',
    permissions:Object.freeze(['ARCHITECTURE_REVIEW','SCHEMA_VALIDATION','PUSH_PROPOSAL']),
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
const MASTER_PRINCIPALS=Object.freeze({
  'MASTER-1':1,
  'MASTER-2':2,
  'MASTER-3':3,
  'master-1':1,
  'master-2':2,
  'master-3':3,
});
const isMasterPrincipal=(agentId,role=null)=>Boolean(MASTER_PRINCIPALS[String(role??'').trim()]||MASTER_PRINCIPALS[String(agentId??'').trim()]);
const masterPriority=(agentId,role=null)=>MASTER_PRINCIPALS[String(role??'').trim()]??MASTER_PRINCIPALS[String(agentId??'').trim()]??null;

const positiveDuration=(value,fallback)=>{const n=Number(value);return Number.isFinite(n)&&n>0?Math.floor(n):fallback;};
const HEARTBEAT_INTERVAL_MS=positiveDuration(process.env.FLIXO_CHAIR_HEARTBEAT_INTERVAL_MS,30_000);
const DEAD_LEASE_AFTER_MS=Math.max(3*HEARTBEAT_INTERVAL_MS,positiveDuration(process.env.FLIXO_CHAIR_DEAD_LEASE_AFTER_MS,90_000));
const SPECULATIVE_CACHE_ROOT=()=>path.resolve(ROOT,String(process.env.FLIXO_CHAIR_SPECULATIVE_CACHE_PATH??'.flixo/cache/chair-readonly'));
const SPECULATIVE_CACHE_TTL_MS=positiveDuration(process.env.FLIXO_CHAIR_SPECULATIVE_CACHE_TTL_MS,15*60*1000);
const SESSION_CONTEXT_ROOT=()=>path.resolve(ROOT,String(process.env.FLIXO_CHAIR_SESSION_CONTEXT_PATH??'.flixo/cache/chair-session'));
const CHAIR_REF_PREFIX=()=>{let value=String(process.env.FLIXO_CHAIR_REF_PREFIX??'refs/flixo/chairs');while(value.endsWith('/')||value.endsWith('\\'))value=value.slice(0,-1);return value;};
const storageKey=(value)=>hash(String(value));
const refValue=(ref)=>{try{return git(['rev-parse','--verify',ref]);}catch{return null;}};
export function atomicChairRefAudit({chairId,targetSha=sha(),expectedOldSha=null,event='UPDATE'}={}){
  if(!CHAIR_DEFINITIONS[chairId])throw new Error('CHAIR_UNKNOWN');
  const t=assertSha(targetSha,'TARGET_SHA');
  if(t!==sha())throw new Error('STALE_CONTEXT');
  const ref=`${CHAIR_REF_PREFIX()}/${chairId}`;
  const current=refValue(ref);
  if(expectedOldSha!==null&&current!==expectedOldSha)throw new Error('CHAIR_REF_COMPARE_FAILED');
  const message=`FLIXO ${event} chair=${chairId} sha=${t}`;
  try{
    if(current)execFileSync('git',['update-ref','-m',message,ref,t,current],{cwd:ROOT,encoding:'utf8'});
    else execFileSync('git',['update-ref','-m',message,ref,t],{cwd:ROOT,encoding:'utf8'});
  }catch(error){throw new Error('CHAIR_REF_AUDIT_FAILED',{cause:error});}
  return Object.freeze({authority:'AUDIT_ONLY',atomicLocalCAS:true,ref,oldSha:current,newSha:t,event});
}
function clearChairRecord(chair,state){
  chair.holder_agent_id=null;chair.holder_role=null;chair.status='VACANT';chair.acquired_at=null;chair.target_sha=null;chair.lease_id=null;chair.review_id=null;chair.scope=null;chair.scope_hash=null;chair.work_package_id=null;chair.task_id=null;chair.fencing_token=null;chair.lease_started_at=null;chair.heartbeat_at=null;chair.heartbeat_count=0;
  state.repository_state=occupied(state).length===0?'IDLE':'ACTIVE';
  state.idle_timestamp=state.repository_state==='IDLE'?now():null;
}
function staleHeartbeat(chair,atMs=Date.now()){
  const stamp=Date.parse(String(chair.heartbeat_at??chair.acquired_at??''));
  return Number.isFinite(stamp)&&atMs-stamp>=DEAD_LEASE_AFTER_MS;
}
export function reconcileDeadLeases({targetSha=sha(),atMs=Date.now()}={}){
  const t=assertSha(targetSha,'TARGET_SHA');
  if(t!==sha())throw new Error('STALE_CONTEXT');
  return withWriteLock(()=>{
    const state=readState();
    if(state.target_sha!==t)throw new Error('CHAIR_STATE_SHA_MISMATCH');
    const reclaimed=[];
    const blocked=[];
    for(const [id,chair] of Object.entries(state.chairs)){
      if(chair.status!=='OCCUPIED'||!staleHeartbeat(chair,atMs))continue;
      const holder=chair.holder_agent_id;
      const leaseId=chair.lease_id;
      if(chair.task_id!==null && chair.task_id!==undefined && String(chair.task_id).trim()!==''){
        blocked.push({chairId:id,agentId:holder,leaseId,taskId:chair.task_id,reason:'TASK_ACTIVE_NONRECLAIMABLE'});
        continue;
      }
      clearChairRecord(chair,state);
      atomicChairRefAudit({chairId:id,targetSha:t,event:'DEAD_LEASE'});
      reclaimed.push({chairId:id,agentId:holder,leaseId,reason:'DEAD_LEASE'});
    }
    if(reclaimed.length||blocked.length){
      state.last_dead_lease={at:now(),atSha:t,reclaimed,blocked};
      if(reclaimed.length) writeState(state);
      else writeState(state);
    }
    return {targetSha:t,deadLeaseAfterMs:DEAD_LEASE_AFTER_MS,reclaimed,blocked,state};
  });
}
export function heartbeat({chairId='chair_1',agentId,targetSha=sha()}={}){
  const t=assertSha(targetSha,'TARGET_SHA');
  if(t!==sha())throw new Error('STALE_CONTEXT');
  return withWriteLock(()=>{
    const state=readState();
    if(state.target_sha!==t)throw new Error('CHAIR_STATE_SHA_MISMATCH');
    const chair=verifyLease({state,chairId,agentId,targetSha:t});
    if(staleHeartbeat(chair))throw new Error('DEAD_LEASE');
    chair.heartbeat_at=now();
    chair.heartbeat_count=Number(chair.heartbeat_count??0)+1;
    state.repository_state='ACTIVE';
    writeState(state);
    return {chairId,agentId,targetSha:t,heartbeatAt:chair.heartbeat_at,heartbeatCount:chair.heartbeat_count,intervalMs:HEARTBEAT_INTERVAL_MS,deadAfterMs:DEAD_LEASE_AFTER_MS};
  });
}
const speculationPath=(sessionId)=>path.join(SPECULATIVE_CACHE_ROOT(),`${storageKey(sessionId)}.json`);
export function writeSpeculativeContext({sessionId,taskId,chairId,role,targetSha=sha(),pendingDiff='',testPlan=[]}={}){
  const session=String(sessionId??'').trim(),task=String(taskId??'').trim(),selected=String(chairId??'').trim(),actorRole=String(role??'').trim();
  if(!session||!task)throw new Error('CHAIR_SPECULATION_CONTEXT_ID_REQUIRED');
  if(!['chair_2','chair_3'].includes(selected))throw new Error('CHAIR_SPECULATION_SEAT_DENIED');
  if(!actorRole)throw new Error('CHAIR_SPECULATION_ROLE_REQUIRED');
  const t=assertSha(targetSha,'TARGET_SHA');
  if(t!==sha())throw new Error('STALE_CONTEXT');
  const diff=String(pendingDiff??'');
  const boundedDiff=Buffer.byteLength(diff,'utf8')>100_000?diff.slice(0,100_000):diff;
  const record={schemaVersion:1,authority:'FLIXO_CHAIR_READ_ONLY_SPECULATION',readOnly:true,sessionId:session,taskId:task,chairId:selected,role:actorRole,targetSha:t,createdAt:now(),expiresAt:new Date(Date.now()+SPECULATIVE_CACHE_TTL_MS).toISOString(),pendingDiff:boundedDiff,pendingDiffSha:boundedDiff?hash(boundedDiff):null,testPlan:Array.isArray(testPlan)?testPlan.map(String).slice(0,200):[]};
  const file=speculationPath(session);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  writeJsonAtomic(file,record);
  return record;
}
export function readSpeculativeContext({sessionId,targetSha=sha()}={}){
  const file=speculationPath(String(sessionId??'').trim());
  if(!fs.existsSync(file))throw new Error('CHAIR_SPECULATION_CONTEXT_MISSING');
  const record=JSON.parse(fs.readFileSync(file,'utf8'));
  const t=assertSha(targetSha,'TARGET_SHA');
  if(t!==sha()||record.targetSha!==t)throw new Error('STALE_CONTEXT');
  if(record.readOnly!==true||record.authority!=='FLIXO_CHAIR_READ_ONLY_SPECULATION')throw new Error('CHAIR_SPECULATION_CONTEXT_INVALID');
  if(Date.parse(String(record.expiresAt??''))<=Date.now())throw new Error('CHAIR_SPECULATION_CONTEXT_EXPIRED');
  return record;
}
export function sanitizeSessionContext({sessionId,taskId=null}={}){
  const session=String(sessionId??'').trim();
  if(!session)throw new Error('CHAIR_CONTEXT_SESSION_ID_REQUIRED');
  const removed=[];
  for(const file of [speculationPath(session),path.join(SESSION_CONTEXT_ROOT(),`${storageKey(session)}.json`)]){
    if(fs.existsSync(file)){fs.rmSync(file,{force:true});removed.push(file);}
  }
  if(taskId){
    const taskFile=path.join(SESSION_CONTEXT_ROOT(),`${storageKey(String(taskId))}.json`);
    if(fs.existsSync(taskFile)){fs.rmSync(taskFile,{force:true});removed.push(taskFile);}
  }
  return {sessionId:session,removed,readOnly:true};
}

const git=(args)=>execFileSync('git',args,{cwd:ROOT,encoding:'utf8'}).trim();
const sha=()=>git(['rev-parse','HEAD']);
const now=()=>new Date().toISOString();
const hash=(v)=>createHash('sha256').update(String(v),'utf8').digest('hex');
const key=()=>String(process.env.FLIXO_CHAIR_SIGNING_KEY??'').trim();
const hmac=(v)=>{const k=key();if(!k)throw new Error('CHAIR_SIGNING_KEY_REQUIRED');return createHmac('sha256',k).update(v,'utf8').digest('hex');};
const statePath=()=>path.resolve(ROOT,String(process.env.FLIXO_CHAIR_STATE_PATH??DEFAULT_STATE));
const assertSha=(v,label='SHA')=>{const x=String(v??'').trim();if(!SHA_RE.test(x))throw new Error('CHAIR_'+label+'_INVALID');return x;};
const assertAgent=(v)=>{const x=String(v??'').trim();if(!AGENT_RE.test(x))throw new Error('CHAIR_AGENT_ID_INVALID');return x;};
const assertContextId=(v,label)=>{const x=String(v??'').trim();if(!x||x.length>240)throw new Error(`CHAIR_${label}_INVALID`);return x;};
const assertFence=(v)=>{const x=String(v??'').trim();if(!HASH_RE.test(x))throw new Error('CHAIR_FENCING_TOKEN_INVALID');return x;};
const scopeDigest=(scope)=>Array.isArray(scope)&&scope.length?hash(JSON.stringify(scope.map(String).sort())):null;

function withWriteLock(fn){
  fs.mkdirSync(path.dirname(LOCK_DIR),{recursive:true});
  try{fs.mkdirSync(LOCK_DIR);}
  catch(error){throw new Error('CHAIR_WRITE_LOCK_BUSY',{cause:error});}
  try{return fn();}
  finally{fs.rmSync(LOCK_DIR,{recursive:true,force:true});}
}

function chairPrimaryMission(chairId){
  return CHAIR_DEFINITIONS[chairId]?.primaryMission ?? null;
}

function assertChair1Mission({chairId,taskId}={}){
  if(chairId!=='chair_1') return;
  if(chairPrimaryMission(chairId)!=='CHAIR1_PRIMARY_TEST_CYCLE_REPAIR') throw new Error('CHAIR1_PRIMARY_MISSION_DRIFT');
  if(taskId===null || taskId===undefined || String(taskId).trim()==='') throw new Error('CHAIR1_TASK_ID_REQUIRED_FOR_REPAIR_MISSION');
}

function assertChair1ReleaseAllowed(chair,{successful=false,reason=''}={}){
  if(chair?.status!=='OCCUPIED'||chair?.task_id==null||String(chair.task_id).trim()==='') return;
  const finalized=successful===true || ['TASK_COMPLETE','TASK_RELEASE','FINALIZED'].includes(String(reason??'').trim());
  if(!finalized) throw new Error('CHAIR1_TASK_ACTIVE_NONRELEASABLE');
}

function baseState(targetSha){
  return {
    schemaVersion:1,
    authority:'FLIXO_CHAIR_BOUND_EXECUTION',
    repository_state:'IDLE',
    idle_timestamp:now(),
    target_sha:assertSha(targetSha,'TARGET_SHA'),
    push_proposals:[],
    rejected_push_memory:[],
    chairs:Object.fromEntries(Object.entries(CHAIR_DEFINITIONS).map(([id,def])=>[id,{
      holder_agent_id:null,holder_role:null,status:'VACANT',permissions:[...def.permissions],acquired_at:null,target_sha:null,lease_id:null,review_id:null,scope:null,scope_hash:null,work_package_id:null,task_id:null,fencing_token:null,lease_started_at:null,heartbeat_at:null,heartbeat_count:0,primary_mission:chairPrimaryMission(id),mission_lock:id==='chair_1'?'UNTIL_TASK_COMPLETE':'UNSET',primary_mission:null,mission_lock:'UNSET'
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
function writeJsonAtomic(file,value){
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=file+'.tmp-'+process.pid+'-'+Date.now();
  fs.writeFileSync(tmp,JSON.stringify(value,null,2)+'\n');
  fs.renameSync(tmp,file);
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
  if(state.last_revoke!==undefined&&typeof state.last_revoke!=='object')throw new Error('CHAIR_LAST_REVOKE_INVALID');
  if(state.last_dead_lease!==undefined&&typeof state.last_dead_lease!=='object')throw new Error('CHAIR_LAST_DEAD_LEASE_INVALID');
  if(state.last_preemption!==undefined&&typeof state.last_preemption!=='object')throw new Error('CHAIR_LAST_PREEMPTION_INVALID');
  if(state.push_proposals!==undefined&&!Array.isArray(state.push_proposals))throw new Error('CHAIR_PUSH_PROPOSALS_INVALID');
  if(state.rejected_push_memory!==undefined&&!Array.isArray(state.rejected_push_memory))throw new Error('CHAIR_REJECTED_PUSH_MEMORY_INVALID');
  assertSha(state.target_sha,'STATE_TARGET_SHA');
  if(!['IDLE','ACTIVE','STALE','LOCKED'].includes(state.repository_state))throw new Error('CHAIR_REPOSITORY_STATE_INVALID');
  for(const id of Object.keys(CHAIR_DEFINITIONS)){
    const chair=state.chairs?.[id];
    if(!chair||!['VACANT','OCCUPIED','REVOKED','STALE'].includes(chair.status))throw new Error('CHAIR_RECORD_INVALID='+id);
    if(chair.status==='OCCUPIED'){
      assertAgent(chair.holder_agent_id);
      if(chair.holder_role!==undefined&&chair.holder_role!==null&&String(chair.holder_role).length>160)throw new Error('CHAIR_HOLDER_ROLE_INVALID');
      assertSha(chair.target_sha,'CHAIR_TARGET_SHA');
      if(!HASH_RE.test(String(chair.lease_id??'')))throw new Error('CHAIR_LEASE_ID_INVALID');
      if(chair.target_sha!==state.target_sha)throw new Error('CHAIR_STATE_SHA_MISMATCH='+id);
    }
  }
  if(state.repository_state==='IDLE'&&Object.values(state.chairs).some(c=>c.status==='OCCUPIED'))throw new Error('CHAIR_IDLE_WITH_OCCUPIED');
  return true;
}
function occupied(state){return Object.entries(state.chairs).filter(([,c])=>c.status==='OCCUPIED');}
function canonicalLease({chairId,agentId,targetSha,permissions,reviewId,scope,workPackageId=null,taskId=null,fencingToken=null}){
  return JSON.stringify({chairId,agentId,targetSha,permissions:[...permissions],reviewId:reviewId??null,scope:scope??null,workPackageId:workPackageId??null,taskId:taskId??null,fencingToken:fencingToken??null});
}
export function leaseIdFor(input){return hash(canonicalLease(input));}
function signLease(input){return hmac(canonicalLease(input));}
export function initialize({targetSha=sha()}={}){
  const t=assertSha(targetSha,'TARGET_SHA');
  if(t!==sha())throw new Error('STALE_CONTEXT');
  return withWriteLock(()=>{
    if(!fs.existsSync(statePath())){
      const state=baseState(t);writeState(state);return state;
    }
    const existing=readState();
    if(existing.target_sha===t)return existing;
    const active=occupied(existing);
    if(existing.repository_state==='IDLE'&&active.length===0&&Object.values(existing.chairs).every((ch)=>ch.status==='VACANT')){
      existing.target_sha=t;
      existing.idle_timestamp=now();
      writeState(existing);
      return existing;
    }
    existing.repository_state='STALE';
    writeState(existing);
    throw new Error('CHAIR_STATE_STALE_ACTIVE');
  });
}
export function acquire({chairId='chair_1',agentId,targetSha=sha(),repositoryState='IDLE',reviewId=null,scope=null,workPackageId=null,taskId=null,fencingToken=null}={}){
  assertAgent(agentId);const t=assertSha(targetSha,'TARGET_SHA');if(t!==sha())throw new Error('STALE_CONTEXT');
  if(!CHAIR_DEFINITIONS[chairId])throw new Error('CHAIR_UNKNOWN');
  return withWriteLock(()=>{
    const state=readState();
    if(state.target_sha!==t)throw new Error('CHAIR_STATE_SHA_MISMATCH');
    for(const chairState of Object.values(state.chairs)) if(chairState.status==='OCCUPIED'&&staleHeartbeat(chairState)) clearChairRecord(chairState,state);
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
    const wp=workPackageId===null?null:assertContextId(workPackageId,'WORK_PACKAGE_ID');
    const task=taskId===null?null:assertContextId(taskId,'TASK_ID');
    const fence=fencingToken===null?null:assertFence(fencingToken);
    if(chairId==='chair_1' && process.env.FLIXO_REQUIRE_FENCED_CHAIR==='true' && (!wp||!task||!fence))throw new Error('CHAIR1_MUTATION_CONTEXT_REQUIRED');
    const leaseInput={chairId,agentId,targetSha:t,permissions:CHAIR_DEFINITIONS[chairId].permissions,reviewId,scope,workPackageId:wp,taskId:task,fencingToken:fence};
    chair.holder_agent_id=agentId;chair.holder_role=String(agentId);chair.status='OCCUPIED';chair.acquired_at=now();chair.lease_started_at=chair.acquired_at;chair.heartbeat_at=chair.acquired_at;chair.heartbeat_count=0;chair.target_sha=t;chair.lease_id=signLease(leaseInput);chair.review_id=reviewId;chair.scope=scope;chair.scope_hash=scopeDigest(scope);chair.work_package_id=wp;chair.task_id=task;chair.fencing_token=fence;
    atomicChairRefAudit({chairId,targetSha:t,event:'ACQUIRE'});
    state.repository_state='ACTIVE';state.idle_timestamp=null;writeState(state);return state;
  });
}
export function preemptChair1ForMaster({agentId,targetSha=sha(),role=null,repositoryState='IDLE',reviewId=null,scope=null,workPackageId=null,taskId=null,fencingToken=null,reason='MASTER_CONNECTED'}={}){
  assertAgent(agentId);
  const t=assertSha(targetSha,'TARGET_SHA');
  if(t!==sha())throw new Error('STALE_CONTEXT');
  if(!isMasterPrincipal(agentId,role))throw new Error('CHAIR1_MASTER_PREEMPTION_REQUIRES_MASTER');
  const incomingPriority=masterPriority(agentId,role);
  return withWriteLock(()=>{
    const state=readState();
    if(state.target_sha!==t)throw new Error('CHAIR_STATE_SHA_MISMATCH');
    for(const chairState of Object.values(state.chairs)) if(chairState.status==='OCCUPIED'&&staleHeartbeat(chairState)) clearChairRecord(chairState,state);
    const chair=state.chairs.chair_1;
    if(chair.status==='OCCUPIED'&&chair.holder_agent_id===agentId){
      const leaseId=chair.lease_id;
      return Object.freeze({admitted:true,reused:true,preempted:false,chairId:'chair_1',leaseId,targetSha:t,taskId:chair.task_id??null,workPackageId:chair.work_package_id??null});
    }
    if(chair.status==='OCCUPIED'){
      if(chair.task_id!==null && chair.task_id!==undefined && String(chair.task_id).trim()!=='') throw new Error('CHAIR1_TASK_ACTIVE_NONPREEMPTABLE');
      const existingPriority=masterPriority(chair.holder_agent_id,chair.holder_role);
      if(existingPriority!==null&&existingPriority<=incomingPriority)throw new Error('CHAIR1_HIGHER_MASTER_ACTIVE');
      const displaced={
        agentId:chair.holder_agent_id,
        role:chair.holder_role??null,
        taskId:chair.task_id??null,
        workPackageId:chair.work_package_id??null,
        leaseId:chair.lease_id,
        targetSha:t,
      };
      clearChairRecord(chair,state);
      atomicChairRefAudit({chairId:'chair_1',targetSha:t,event:'MASTER_PREEMPT_REVOKE'});
      state.last_preemption={
        schemaVersion:1,
        reason:String(reason||'MASTER_CONNECTED'),
        masterAgentId:agentId,
        masterRole:String(role??agentId),
        masterPriority:incomingPriority,
        displacedAgentId:displaced.agentId,
        displacedRole:displaced.role,
        displacedTaskId:displaced.taskId,
        displacedWorkPackageId:displaced.workPackageId,
        displacedLeaseId:displaced.leaseId,
        targetSha:t,
        at:now()
      };
    }
    const wp=workPackageId===null?null:assertContextId(workPackageId,'WORK_PACKAGE_ID');
    const task=taskId===null?null:assertContextId(taskId,'TASK_ID');
    const fence=fencingToken===null?null:assertFence(fencingToken);
    if(process.env.FLIXO_REQUIRE_FENCED_CHAIR==='true' && (!wp||!task||!fence))throw new Error('CHAIR1_MUTATION_CONTEXT_REQUIRED');
    const leaseInput={chairId:'chair_1',agentId,targetSha:t,permissions:CHAIR_DEFINITIONS.chair_1.permissions,reviewId,scope,workPackageId:wp,taskId:task,fencingToken:fence};
    chair.holder_agent_id=agentId;
    chair.holder_role=String(role??agentId);
    chair.status='OCCUPIED';
    chair.acquired_at=now();
    chair.lease_started_at=chair.acquired_at;
    chair.heartbeat_at=chair.acquired_at;
    chair.heartbeat_count=0;
    chair.target_sha=t;
    chair.lease_id=signLease(leaseInput);
    chair.review_id=reviewId;
    chair.scope=scope;
    chair.scope_hash=scopeDigest(scope);
    chair.work_package_id=wp;
    chair.task_id=task;
    chair.fencing_token=fence;
    chair.primary_mission=chairPrimaryMission('chair_1');
    chair.mission_lock='UNTIL_TASK_COMPLETE';
    assertChair1Mission({chairId:'chair_1',taskId:task});
    atomicChairRefAudit({chairId:'chair_1',targetSha:t,event:'MASTER_PREEMPT_ACQUIRE'});
    state.repository_state='ACTIVE';
    state.idle_timestamp=null;
    writeState(state);
    return Object.freeze({admitted:true,reused:false,preempted:Boolean(state.last_preemption?.displacedAgentId),preemptedAgentId:state.last_preemption?.displacedAgentId??null,chairId:'chair_1',leaseId:chair.lease_id,targetSha:t,taskId:chair.task_id??null,workPackageId:chair.work_package_id??null});
  });
}

function getChair(state,chairId){
  const chair=state?.chairs?.[chairId];
  if(!chair)throw new Error('CHAIR_UNKNOWN');
  if(chair.status!=='OCCUPIED')throw new Error('CHAIR_NOT_OCCUPIED');
  return chair;
}
function verifyLease({state,chairId,agentId,targetSha,assertCurrentHead=true}){
  const t=assertSha(targetSha,'TARGET_SHA');if(assertCurrentHead && t!==sha())throw new Error('STALE_CONTEXT');
  const chair=getChair(state,chairId);
  if(chair.holder_agent_id!==agentId)throw new Error('UNAUTHORIZED_EXECUTION_ATTEMPT');
  if(chair.target_sha!==t||state.target_sha!==t)throw new Error('STALE_CONTEXT');
  const input={chairId,agentId,targetSha:t,permissions:CHAIR_DEFINITIONS[chairId].permissions,reviewId:chair.review_id,scope:chair.scope,workPackageId:chair.work_package_id??null,taskId:chair.task_id??null,fencingToken:chair.fencing_token??null};
  const expected=signLease(input);
  const supplied=String(chair.lease_id??'');
  if(!HASH_RE.test(supplied)||!timingSafeEqual(Buffer.from(expected,'utf8'),Buffer.from(supplied,'utf8')))throw new Error('CHAIR_LEASE_SIGNATURE_INVALID');
  return chair;
}
export function authorizeWrite({chairId,agentId,targetSha=sha(),paths=[],permission='SOURCE_MUTATION',reviewId=null,boundedScope=null,workPackageId=null,taskId=null,fencingToken=null}={}){
  if(!Array.isArray(paths)||paths.length===0)throw new Error('CHAIR_WRITE_PATHS_REQUIRED');
  const t=assertSha(targetSha,'TARGET_SHA');
  const state=readState();
  if(state.target_sha!==t)throw new Error('STALE_CONTEXT');
  const chair=verifyLease({state,chairId,agentId,targetSha:t});
  const def=CHAIR_DEFINITIONS[chairId];
  if(chair.work_package_id!==null && chair.work_package_id!==String(workPackageId??''))throw new Error('CHAIR_WORK_PACKAGE_MISMATCH');
  if(chair.task_id!==null && chair.task_id!==String(taskId??''))throw new Error('CHAIR_TASK_MISMATCH');
  if(chair.fencing_token!==null && chair.fencing_token!==String(fencingToken??''))throw new Error('CHAIR_FENCING_TOKEN_MISMATCH');
  if(chair.scope_hash!==null && chair.scope_hash!==scopeDigest(paths))throw new Error('CHAIR_SCOPE_HASH_MISMATCH');
  if(!def.permissions.includes(permission))throw new Error('CHAIR_PERMISSION_DENIED='+permission);
  if(chairId==='chair_1'&&permission==='MERGE_PROPOSAL')throw new Error('MERGE_PROPOSAL_IS_NOT_MERGE_AUTHORITY');
  if(['chair_2','chair_3'].includes(chairId)&&permission==='SOURCE_MUTATION'&&chairId==='chair_2'&&!boundedScope?.length)throw new Error('CHAIR2_BOUNDED_SCOPE_REQUIRED');
  if(chairId==='chair_3'&&(!reviewId||reviewId!==chair.review_id))throw new Error('CHAIR3_REVIEW_ID_MISMATCH');
  const normalized=paths.map(p=>String(p).replaceAll('\\','/').replace(/^\.\//,''));
  if(normalized.some(p=>p.startsWith('/')||p.includes('..')))throw new Error('CHAIR_PATH_INVALID');
  for(const p of normalized){
    if(def.protectedPrefixes.some(prefix=>p===prefix||p.startsWith(prefix)))throw new Error('CHAIR_PROTECTED_PATH');
    if(!def.allowedPrefixes.some(prefix=>p.startsWith(prefix)))throw new Error('CHAIR_SCOPE_DENIED='+p);
  }
  if(chairId==='chair_2'&&permission==='SOURCE_MUTATION'&&occupied(state).some(([id])=>id==='chair_1'))throw new Error('CHAIR2_WRITE_BLOCKED_WHILE_CHAIR1_ACTIVE');
  if(chairId==='chair_2'&&permission==='SOURCE_MUTATION'){
    const scope=new Set((boundedScope??[]).map((p)=>{ const value=String(p).replaceAll('\\\\','/'); return value.startsWith('./') ? value.slice(2) : value; }));
    if(normalized.some(p=>!scope.has(p)))throw new Error('CHAIR2_SCOPE_DRIFT');
    if(normalized.some(p=>!scope.has(p)))throw new Error('CHAIR2_SCOPE_DRIFT');
  }
  return Object.freeze({authorized:true,chairId,agentId,targetSha:t,permission,paths:normalized,mode:def.mode,singleAgentMode:chairId==='chair_1'&&occupied(state).length===1});
}
export function authorizePublication({chairId='chair_1',agentId,targetSha=sha(),paths=[],permission='SOURCE_MUTATION',workPackageId=null,taskId=null,fencingToken=null}={}) {
  if(!Array.isArray(paths)||paths.length===0)throw new Error('CHAIR_WRITE_PATHS_REQUIRED');
  const t=assertSha(targetSha,'TARGET_SHA');
  const state=readState();
  if(state.target_sha!==t)throw new Error('STALE_CONTEXT');
  const chair=verifyLease({state,chairId,agentId,targetSha:t,assertCurrentHead:false});
  const def=CHAIR_DEFINITIONS[chairId];
  if(!def.permissions.includes(permission))throw new Error('CHAIR_PERMISSION_DENIED='+permission);
  if(chair.work_package_id!==null && chair.work_package_id!==String(workPackageId??''))throw new Error('CHAIR_WORK_PACKAGE_MISMATCH');
  if(chair.task_id!==null && chair.task_id!==String(taskId??''))throw new Error('CHAIR_TASK_MISMATCH');
  if(chair.fencing_token!==null && chair.fencing_token!==String(fencingToken??''))throw new Error('CHAIR_FENCING_TOKEN_MISMATCH');
  const normalized=paths.map(p=>String(p).replaceAll('\\','/').replace(/^\.\//,''));
  if(chair.scope_hash!==null && !(Array.isArray(chair.scope)&&chair.scope.length===1&&String(chair.scope[0])==='*') && chair.scope_hash!==scopeDigest(paths))throw new Error('CHAIR_SCOPE_HASH_MISMATCH');
  for(const p of normalized){
    if(p==='*')continue;
    if(p.startsWith('/')||p.includes('..'))throw new Error('CHAIR_PATH_INVALID');
    if(def.protectedPrefixes.some(prefix=>p===prefix||p.startsWith(prefix)))throw new Error('CHAIR_PROTECTED_PATH');
    if(!def.allowedPrefixes.some(prefix=>p.startsWith(prefix)))throw new Error('CHAIR_SCOPE_DENIED='+p);
  }
  return Object.freeze({authorized:true,publicationOnly:true,chairId,agentId,targetSha:t,permission,paths:normalized});
}

export function proposePush({
  chairId,
  agentId,
  targetSha=sha(),
  candidateSha,
  parentSha,
  paths=[],
  workPackageId,
  taskId,
  patchSha256=null,
  summary=''
}={}){
  if(!['chair_2','chair_3'].includes(chairId))throw new Error('CHAIR_PUSH_PROPOSAL_SEAT_REQUIRED');
  const t=assertSha(targetSha,'TARGET_SHA');
  const candidate=assertSha(candidateSha,'CANDIDATE_SHA');
  const parent=assertSha(parentSha,'PARENT_SHA');
  if(t!==sha())throw new Error('STALE_CONTEXT');
  if(parent!==t)throw new Error('CHAIR_PUSH_PARENT_MISMATCH');
  if(candidate===t)throw new Error('CHAIR_PUSH_EMPTY_CANDIDATE');
  const state=readState();
  const chair=verifyLease({state,chairId,agentId,targetSha:t});
  const normalized=[...new Set(paths.map(p=>String(p).replaceAll('\\','/').replace(/^\.\//,'')))].sort();
  if(!normalized.length)throw new Error('CHAIR_PUSH_PATHS_REQUIRED');
  const def=CHAIR_DEFINITIONS[chairId];
  for(const p of normalized){
    if(p.startsWith('/')||p.includes('..'))throw new Error('CHAIR_PUSH_PATH_INVALID');
    if(def.protectedPrefixes.some(prefix=>p===prefix||p.startsWith(prefix)))throw new Error('CHAIR_PUSH_PROTECTED_PATH');
    if(!def.allowedPrefixes.some(prefix=>p.startsWith(prefix)))throw new Error('CHAIR_PUSH_SCOPE_DENIED='+p);
  }
  if(chair.scope_hash!==null && chair.scope_hash!==scopeDigest(normalized))throw new Error('CHAIR_PUSH_SCOPE_HASH_MISMATCH');
  const wp=assertContextId(workPackageId,'WORK_PACKAGE_ID');
  const task=assertContextId(taskId,'TASK_ID');
  const proposalId=hash(JSON.stringify({chairId,agentId,targetSha:t,candidateSha:candidate,parentSha:parent,paths:normalized,workPackageId:wp,taskId:task,patchSha256:patchSha256??null}));
  return withWriteLock(()=>{
    const fresh=readState();
    if(fresh.target_sha!==t)throw new Error('STALE_CONTEXT');
    const proposal={
      schemaVersion:1,
      protocol:'FLIXO-CHAIR-PUSH-PROPOSAL-v1',
      proposalId,
      status:'PENDING_GUARD',
      proposerChair:chairId,
      proposerAgent:agentId,
      targetSha:t,
      parentSha:parent,
      candidateSha:candidate,
      workPackageId:wp,
      taskId:task,
      paths:normalized,
      scopeHash:scopeDigest(normalized),
      patchSha256:patchSha256&&HASH_RE.test(String(patchSha256))?String(patchSha256):null,
      summary:String(summary??'').slice(0,4000),
      createdAt:now(),
      guardDecision:null
    };
    fresh.push_proposals=Array.isArray(fresh.push_proposals)?fresh.push_proposals.slice(-199):[];
    fresh.push_proposals.push(proposal);
    writeState(fresh);
    return proposal;
  });
}

export function authorizeMergeProposal({chairId,agentId,targetSha=sha()}={}){
  const state=readState();const chair=verifyLease({state,chairId,agentId,targetSha});
  if(!CHAIR_DEFINITIONS[chairId].permissions.includes('MERGE_PROPOSAL'))throw new Error('CHAIR_MERGE_PROPOSAL_PERMISSION_DENIED');
  return Object.freeze({authorized:true,proposalOnly:true,requiresPromotionGate:true,chairId,agentId,targetSha:chair.target_sha});
}
export function recordGuardDecision({
  proposalId,
  decision,
  reasonCode,
  guardAgent='CHAIR_PUSH_GUARD',
  currentSha=sha(),
  guardEvidence=null
}={}){
  const id=assertContextId(proposalId,'PROPOSAL_ID');
  const verdict=String(decision??'').trim().toUpperCase();
  if(!['READY_FOR_CHAIR_1','REJECTED'].includes(verdict))throw new Error('CHAIR_GUARD_DECISION_INVALID');
  const t=assertSha(currentSha,'CURRENT_SHA');
  if(t!==sha())throw new Error('STALE_CONTEXT');
  const reason=assertContextId(reasonCode||'UNSPECIFIED','REASON_CODE');
  return withWriteLock(()=>{
    const state=readState();
    const idx=(state.push_proposals??[]).findIndex((p)=>p.proposalId===id);
    if(idx<0)throw new Error('CHAIR_PUSH_PROPOSAL_NOT_FOUND');
    const proposal=state.push_proposals[idx];
    if(proposal.targetSha!==t)throw new Error('CHAIR_PUSH_PROPOSAL_STALE');
    const decisionRecord={decision:verdict,reasonCode:reason,guardAgent:String(guardAgent),currentSha:t,guardEvidence:guardEvidence??null,decidedAt:now()};
    proposal.status=verdict;
    proposal.guardDecision=decisionRecord;
    if(verdict==='REJECTED'){
      state.rejected_push_memory=Array.isArray(state.rejected_push_memory)?state.rejected_push_memory.slice(-499):[];
      state.rejected_push_memory.push({
        schemaVersion:1,
        protocol:'FLIXO-REJECTED-PUSH-MEMORY-v1',
        memoryId:hash(JSON.stringify({proposalId:id,currentSha:t,reasonCode:reason})),
        proposalId:id,
        proposerChair:proposal.proposerChair,
        proposerAgent:proposal.proposerAgent,
        targetSha:proposal.targetSha,
        parentSha:proposal.parentSha,
        candidateSha:proposal.candidateSha,
        workPackageId:proposal.workPackageId,
        taskId:proposal.taskId,
        paths:proposal.paths,
        patchSha256:proposal.patchSha256,
        reasonCode:reason,
        summary:proposal.summary,
        guardEvidence:guardEvidence??null,
        reusableAfter:'CHAIR_1_REVALIDATES_CURRENT_SHA_AND_CONFLICT_STATE',
        createdAt:proposal.createdAt,
        rejectedAt:now()
      });
    }
    writeState(state);
    return Object.freeze({proposal,status:verdict,decision:decisionRecord,rejectedPushMemory:verdict==='REJECTED'?state.rejected_push_memory.at(-1):null});
  });
}

export function revoke({chairId='chair_1',agentId,reason='STALE_CONTEXT',sessionId=null,taskId=null}={}){
  assertAgent(agentId);
  if(!CHAIR_DEFINITIONS[chairId])throw new Error('CHAIR_UNKNOWN');
  return withWriteLock(()=>{
    const state=readState();
    const chair=state.chairs[chairId];
    if(chair.status!=='OCCUPIED')throw new Error('CHAIR_NOT_OCCUPIED');
    if(chair.holder_agent_id!==agentId)throw new Error('UNAUTHORIZED_EXECUTION_ATTEMPT');
    assertChair1ReleaseAllowed(chair,{successful:false,reason:'REVOKE'});
    if(sessionId)sanitizeSessionContext({sessionId,taskId});
    clearChairRecord(chair,state);
    atomicChairRefAudit({chairId,targetSha:state.target_sha,event:'REVOKE'});
    state.last_revoke={chairId,agentId,reason:String(reason),at:now()};
    writeState(state);
    return state;
  });
}

export function release({chairId,agentId,targetSha=sha(),successful=false,sessionId=null,taskId=null}={}){
  const t=assertSha(targetSha,'TARGET_SHA');
  return withWriteLock(()=>{
    const state=readState();const chair=verifyLease({state,chairId,agentId,targetSha:t,assertCurrentHead:false});
    const state=readState();const chair=verifyLease({state,chairId,agentId,targetSha:t,assertCurrentHead:false});
    assertChair1ReleaseAllowed(chair,{successful,reason:successful===true?'TASK_COMPLETE':'RELEASE'});
    if(sessionId)sanitizeSessionContext({sessionId,taskId});
    clearChairRecord(chair,state);
    atomicChairRefAudit({chairId,targetSha:t,event:'RELEASE'});
    if(successful===true&&state.repository_state==='ACTIVE')state.repository_state='ACTIVE';
    writeState(state);return state;
  });
}
}
export function validateCurrent({chairId,agentId,targetSha=sha(),paths=[],permission='SOURCE_MUTATION',reviewId=null,boundedScope=null,workPackageId=null,taskId=null,fencingToken=null}={}){
  const t=assertSha(targetSha,'TARGET_SHA');if(t!==sha())throw new Error('STALE_CONTEXT');
  return authorizeWrite({chairId,agentId,targetSha:t,paths,permission,reviewId,boundedScope,workPackageId,taskId,fencingToken});
}
export function activeChairForAgent({agentId,targetSha=sha()}={}){
  assertAgent(agentId);
  const t=assertSha(targetSha,'TARGET_SHA');
  if(t!==sha())throw new Error('STALE_CONTEXT');
  const state=readState();
  if(state.target_sha!==t)throw new Error('CHAIR_STATE_SHA_MISMATCH');
  const found=[];
  for(const [chairId,chair] of Object.entries(state.chairs)){
    if(chair.status==='OCCUPIED'&&chair.holder_agent_id===agentId){
      verifyLease({state,chairId,agentId,targetSha:t});
      found.push({chairId,leaseId:chair.lease_id,taskId:chair.task_id??null,workPackageId:chair.work_package_id??null,targetSha:t});
    }
  }
  if(found.length>1)throw new Error('CHAIR_AGENT_MULTI_OCCUPANCY');
  return found[0]??null;
}

export function assertWorkAdmission({agentId,targetSha=sha(),chairId=null,taskId=null}={}){
  const active=activeChairForAgent({agentId,targetSha});
  if(!active){
    const state=readState();
    const preemption=state.last_preemption;
    if(preemption?.targetSha===String(targetSha)&&preemption?.displacedAgentId===agentId&&preemption?.displacedTaskId!==null&&String(preemption.displacedTaskId)===String(taskId??''))throw new Error('AGENT_WORK_CHAIR_PREEMPTED');
    if(preemption?.targetSha===String(targetSha)&&preemption?.displacedAgentId===agentId&&preemption?.displacedTaskId!==null&&String(preemption.displacedTaskId)===String(taskId??''))throw new Error('AGENT_WORK_CHAIR_PREEMPTED');
    throw new Error('AGENT_WORK_REQUIRES_CHAIR');
  }
  if(chairId&&active.chairId!==chairId)throw new Error('AGENT_WORK_CHAIR_MISMATCH');
  return active;
}

export function beginWork({agentId,targetSha=sha(),requestedChairId=null,repositoryState='IDLE',workPackageId=null,taskId=null,fencingToken=null,scope=null,reviewId=null,role=null}={}){
  assertAgent(agentId);
  const t=assertSha(targetSha,'TARGET_SHA');
  if(t!==sha())throw new Error('STALE_CONTEXT');
  const existing=activeChairForAgent({agentId,targetSha:t});
  if(existing)return Object.freeze({admitted:true,reused:true,...existing});
  const lastPreemption=readState().last_preemption;
  if(lastPreemption?.targetSha===t&&lastPreemption.displacedAgentId===agentId&&lastPreemption.displacedTaskId!==null&&String(lastPreemption.displacedTaskId)===String(taskId??''))throw new Error('AGENT_WORK_CHAIR_PREEMPTED');
  const chairId=String(requestedChairId??'chair_1').trim()||'chair_1';
  if(chairId!=='chair_1' && chairId!=='chair_2' && chairId!=='chair_3')throw new Error('CHAIR_UNKNOWN');
  if(chairId!=='chair_1')throw new Error('CHAIR_AUTO_ADMISSION_MUST_USE_CHAIR_1');
  if(isMasterPrincipal(agentId,role))return preemptChair1ForMaster({agentId,targetSha:t,role,repositoryState,workPackageId,taskId,fencingToken,scope,reviewId});
  const acquired=acquire({
    chairId,
    agentId,
    targetSha:t,
    repositoryState,
    reviewId,
    scope,
    workPackageId,
    taskId,
    fencingToken
  });
  const chair=acquired.chairs[chairId];
  return Object.freeze({admitted:true,reused:false,chairId,leaseId:chair.lease_id,targetSha:t,taskId:chair.task_id??null,workPackageId:chair.work_package_id??null,primaryMission:chair.primary_mission??chairPrimaryMission(chairId),missionLock:chair.mission_lock??'UNSET'});
}

export function endWork({agentId,targetSha=sha(),successful=false,sessionId=null,taskId=null}={}){
  const active=activeChairForAgent({agentId,targetSha});
  if(!active)throw new Error('AGENT_WORK_CHAIR_MISSING_AT_END');
  return release({chairId:active.chairId,agentId,targetSha,successful,sessionId,taskId});
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
  else if(command==='acquire')console.log(JSON.stringify(acquire({chairId:arg('chair','chair_1'),agentId:arg('agent'),targetSha:target,repositoryState:arg('repository-state','IDLE'),reviewId:arg('review-id')||null,scope:scope.length?scope:null,workPackageId:arg('work-package')||null,taskId:arg('task-id')||null,fencingToken:arg('fencing-token')||null}),null,2));
  else if(command==='authorize-write')console.log(JSON.stringify(authorizeWrite({chairId:arg('chair','chair_1'),agentId:arg('agent'),targetSha:target,paths,permission:arg('permission','SOURCE_MUTATION'),reviewId:arg('review-id')||null,boundedScope:scope.length?scope:null,workPackageId:arg('work-package')||null,taskId:arg('task-id')||null,fencingToken:arg('fencing-token')||null}),null,2));
  else if(command==='merge-proposal')console.log(JSON.stringify(authorizeMergeProposal({chairId:arg('chair','chair_1'),agentId:arg('agent'),targetSha:target}),null,2));
  else if(command==='propose-push')console.log(JSON.stringify(proposePush({chairId:arg('chair'),agentId:arg('agent'),targetSha:target,candidateSha:arg('candidate'),parentSha:arg('parent'),paths,workPackageId:arg('work-package'),taskId:arg('task-id'),patchSha256:arg('patch-sha')||null,summary:arg('summary')||''}),null,2));
  else if(command==='authorize-publication')console.log(JSON.stringify(authorizePublication({chairId:arg('chair','chair_1'),agentId:arg('agent'),targetSha:target,paths,permission:arg('permission','SOURCE_MUTATION'),workPackageId:arg('work-package')||null,taskId:arg('task-id')||null,fencingToken:arg('fencing-token')||null}),null,2));
  else if(command==='guard-decision')console.log(JSON.stringify(recordGuardDecision({proposalId:arg('proposal-id'),decision:arg('decision'),reasonCode:arg('reason'),guardAgent:arg('guard-agent','CHAIR_PUSH_GUARD'),currentSha:target,guardEvidence:arg('evidence')||null}),null,2));
  else if(command==='release')console.log(JSON.stringify(release({chairId:arg('chair','chair_1'),agentId:arg('agent'),targetSha:target,successful:arg('successful','false')==='true'}),null,2));
  else if(command==='mode')console.log(JSON.stringify(repositoryMode({targetSha:target}),null,2));
  else if(command==='validate')console.log(JSON.stringify(validateCurrent({chairId:arg('chair','chair_1'),agentId:arg('agent'),targetSha:target,paths,permission:arg('permission','SOURCE_MUTATION'),reviewId:arg('review-id')||null,boundedScope:scope.length?scope:null}),null,2));
  else if(command==='heartbeat')console.log(JSON.stringify(heartbeat({chairId:arg('chair','chair_1'),agentId:arg('agent'),targetSha:target}),null,2));
  else if(command==='reconcile-dead-leases')console.log(JSON.stringify(reconcileDeadLeases({targetSha:target}),null,2));
  else if(command==='master-preempt')console.log(JSON.stringify(preemptChair1ForMaster({agentId:arg('agent'),role:arg('role')||null,targetSha:target,repositoryState:arg('repository-state','IDLE'),workPackageId:arg('work-package')||null,taskId:arg('task-id')||null,fencingToken:arg('fencing-token')||null,scope:scope.length?scope:null,reviewId:arg('review-id')||null,reason:arg('reason','MASTER_CONNECTED')}),null,2));
  else if(command==='speculate')console.log(JSON.stringify(writeSpeculativeContext({sessionId:arg('session'),taskId:arg('task'),chairId:arg('chair'),role:arg('role'),targetSha:target,pendingDiff:arg('pending-diff'),testPlan:arg('test-plan').split(';').map(v=>v.trim()).filter(Boolean)}),null,2));
  else throw new Error('Usage: chair-bound-execution.mjs init|acquire|authorize-write|merge-proposal|release|mode|validate');
}