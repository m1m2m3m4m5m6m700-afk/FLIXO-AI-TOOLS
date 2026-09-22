#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { execFileSync } from 'node:child_process';

export const CHAIR_DEFINITIONS = Object.freeze({
  chair_1:Object.freeze({
    mode:'CENTRAL_CUSTODY_DELEGATION_MODE',
    primaryMission:'CHAIR1_TEMPORARY_TASK_DELEGATION',
    missionContract:'Chair-1 remains centrally owned by assistantController; an admitted agent may temporarily borrow the chair for one bounded task, execute only within that task scope, and return custody automatically when the task closes.',
    missionStopConditions:Object.freeze(['TASK_COMPLETE','TASK_RELEASE','STALE_SHA','PROOF_FAILED','BLOCKED_EXTERNAL']),
    permissions:Object.freeze(['AGGREGATE_PENDING_CHANGES','EDIT_PENDING_CHANGES','SOURCE_MUTATION','MERGE_PROPOSAL','FINAL_PUBLICATION','SINGLE_AGENT_MODE']),
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
export const CHAIR1_OWNER_AGENT='assistantController';

const positiveDuration=(value,fallback)=>{const n=Number(value);return Number.isFinite(n)&&n>0?Math.floor(n):fallback;};
const HEARTBEAT_INTERVAL_MS=positiveDuration(process.env.FLIXO_CHAIR_HEARTBEAT_INTERVAL_MS,30_000);
const DEAD_LEASE_AFTER_MS=Math.max(3*HEARTBEAT_INTERVAL_MS,positiveDuration(process.env.FLIXO_CHAIR_DEAD_LEASE_AFTER_MS,90_000));
const SPECULATIVE_CACHE_ROOT=()=>path.resolve(ROOT,String(process.env.FLIXO_CHAIR_SPECULATIVE_CACHE_PATH??'.flixo/cache/chair-readonly'));
const SPECULATIVE_CACHE_TTL_MS=positiveDuration(process.env.FLIXO_CHAIR_SPECULATIVE_CACHE_TTL_MS,15*60*1000);
const SESSION_CONTEXT_ROOT=()=>path.resolve(ROOT,String(process.env.FLIXO_CHAIR_SESSION_CONTEXT_PATH??'.flixo/cache/chair-session'));
const centralChairStrict = () => true;
let centralChairTestTransport = null;

export function configureCentralChairTestTransport({verify,release}={}){
  if(process.env.NODE_ENV !== 'test') throw new Error('CENTRAL_CHAIR_TEST_TRANSPORT_FORBIDDEN');
  if(typeof verify !== 'function') throw new Error('CENTRAL_CHAIR_TEST_VERIFY_REQUIRED');
  centralChairTestTransport={verify,release:typeof release==='function'?release:null};
}

function centralChairProof(result,{agentId,targetSha,workPackageId,taskId,leaseId,fence}){
  const r=result?.state&&typeof result.state==='object'?result.state:result;
  const owner=r?.ownerAgentId??r?.owner_agent_id;
  const holder=r?.holderAgentId??r?.holder_agent_id;
  const task=r?.taskId??r?.task_id;
  const workPackage=r?.workPackageId??r?.work_package_id;
  const exactSha=r?.exactSha??r?.exact_sha;
  const receivedLease=r?.leaseId??r?.lease_id;
  const receivedFence=r?.fencingTokenHash??r?.fencing_token_hash;
  const delegatedBy=r?.delegatedBy??r?.delegated_by;
  if(r?.authorized!==true || owner!==CHAIR1_OWNER_AGENT || holder!==agentId || task!==String(taskId??'') ||
     workPackage!==String(workPackageId??'') || exactSha!==targetSha || receivedLease!==leaseId ||
     receivedFence!==fence || delegatedBy!==CHAIR1_OWNER_AGENT){
    throw new Error('CENTRAL_CHAIR_PROOF_INVALID');
  }
  return Object.freeze({
    authorized:true,
    chairId:'chair_1',
    ownerAgentId:owner,
    holderAgentId:holder,
    taskId:task,
    workPackageId:workPackage,
    exactSha,
    leaseId:receivedLease,
    fencingTokenHash:receivedFence,
    delegatedBy,
  });
}

function verifyCentralChairForMutation({agentId,targetSha,workPackageId,taskId}){
  const leaseId=String(process.env.FLIXO_CHAIR_LEASE_ID??'').trim();
  const fence=String(process.env.FLIXO_CHAIR_FENCING_HASH??'').trim();
  const holder=String(process.env.FLIXO_CHAIR_AGENT??agentId??'').trim();
  if(!leaseId||!fence||!holder||holder!==agentId) throw new Error('CENTRAL_CHAIR_REQUIRED_FOR_MUTATION');
  const args={holder,task:String(taskId??''),workPackage:String(workPackageId??''),sha:String(targetSha),leaseId,fence};
  if(centralChairTestTransport){
    return centralChairProof(centralChairTestTransport.verify(args),{agentId,targetSha:String(targetSha),workPackageId,taskId,leaseId,fence});
  }
  let raw='';
  try{
    raw=execFileSync('node',['scripts/ci/central-chair-lease.mjs','verify',
      '--holder='+holder,'--task='+String(taskId??''),'--work-package='+String(workPackageId??''),
      '--sha='+String(targetSha),'--lease-id='+leaseId,'--fencing-hash='+fence],{cwd:process.cwd(),encoding:'utf8',stdio:'pipe'});
  }catch(error){throw new Error('CENTRAL_CHAIR_VERIFICATION_FAILED',{cause:error});}
  let result=null;
  try{result=JSON.parse(raw);}catch(error){throw new Error('CENTRAL_CHAIR_PROOF_INVALID',{cause:error});}
  return centralChairProof(result,{agentId,targetSha:String(targetSha),workPackageId,taskId,leaseId,fence});
}

function releaseCentralChair({agentId,targetSha,workPackageId,taskId}){
  const leaseId=String(process.env.FLIXO_CHAIR_LEASE_ID??'').trim();
  const fence=String(process.env.FLIXO_CHAIR_FENCING_HASH??'').trim();
  const holder=String(process.env.FLIXO_CHAIR_AGENT??agentId??'').trim();
  if(!leaseId||!fence||holder!==agentId) throw new Error('CENTRAL_CHAIR_RELEASE_CONTEXT_REQUIRED');
  const args={holder,task:String(taskId??''),workPackage:String(workPackageId??''),sha:String(targetSha),leaseId,fence};
  if(centralChairTestTransport?.release){
    const result=centralChairTestTransport.release(args);
    const r=result?.state&&typeof result.state==='object'?result.state:result;
    if((r?.ownerAgentId??r?.owner_agent_id)!==CHAIR1_OWNER_AGENT ||
       (r?.status??'')!=='OWNER_CUSTODY') throw new Error('CENTRAL_CHAIR_RELEASE_PROOF_INVALID');
    return result;
  }
  let raw='';
  try{
    raw=execFileSync('node',['scripts/ci/central-chair-lease.mjs','release',
      '--holder='+holder,'--task='+String(taskId??''),'--work-package='+String(workPackageId??''),
      '--sha='+String(targetSha),'--lease-id='+leaseId,'--fencing-hash='+fence,'--successful=true'],{cwd:process.cwd(),encoding:'utf8',stdio:'pipe'});
  }catch(error){throw new Error('CENTRAL_CHAIR_RELEASE_FAILED',{cause:error});}
  let result=null;
  try{result=JSON.parse(raw);}catch(error){throw new Error('CENTRAL_CHAIR_RELEASE_PROOF_INVALID',{cause:error});}
  const r=result?.state&&typeof result.state==='object'?result.state:result;
  if((r?.ownerAgentId??r?.owner_agent_id)!==CHAIR1_OWNER_AGENT || (r?.status??'')!=='OWNER_CUSTODY') throw new Error('CENTRAL_CHAIR_RELEASE_PROOF_INVALID');
  return result;
}
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
  const wasChair1=chair===state.chairs?.chair_1;
  chair.holder_agent_id=null;chair.holder_role=null;chair.status='VACANT';chair.acquired_at=null;chair.target_sha=null;chair.lease_id=null;chair.review_id=null;chair.scope=null;chair.scope_hash=null;chair.work_package_id=null;chair.task_id=null;chair.fencing_token=null;chair.lease_started_at=null;chair.heartbeat_at=null;chair.heartbeat_count=0;
  if(wasChair1){
    chair.owner_agent_id=CHAIR1_OWNER_AGENT;
    chair.owner_role=CHAIR1_OWNER_AGENT;
    chair.custody_status='OWNER_CUSTODY';
    chair.delegation_id=null;
    chair.delegated_by=null;
    chair.delegated_at=null;
    chair.auto_return_on_task_close=true;
    chair.returned_at=now();
    chair.return_reason='AUTO_RETURN_AFTER_TASK_RELEASE';
  }
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
    preemption_history:[],
    chairs:Object.fromEntries(Object.entries(CHAIR_DEFINITIONS).map(([id,def])=>[id,{
      holder_agent_id:null,holder_role:null,status:'VACANT',permissions:[...def.permissions],acquired_at:null,target_sha:null,lease_id:null,review_id:null,scope:null,scope_hash:null,work_package_id:null,task_id:null,fencing_token:null,lease_started_at:null,heartbeat_at:null,heartbeat_count:0,primary_mission:chairPrimaryMission(id),mission_lock:id==='chair_1'?'UNTIL_TASK_COMPLETE':'UNSET',owner_agent_id:id==='chair_1'?CHAIR1_OWNER_AGENT:null,owner_role:id==='chair_1'?CHAIR1_OWNER_AGENT:null,custody_status:id==='chair_1'?'OWNER_CUSTODY':'UNASSIGNED',delegation_id:null,delegated_by:null,delegated_at:null,auto_return_on_task_close:id==='chair_1',returned_at:null,return_reason:null
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
  if(state.preemption_history!==undefined&&!Array.isArray(state.preemption_history))throw new Error('CHAIR_PREEMPTION_HISTORY_INVALID');
  if(state.last_preemption!==undefined&&typeof state.last_preemption!=='object')throw new Error('CHAIR_LAST_PREEMPTION_INVALID');
  if(state.push_proposals!==undefined&&!Array.isArray(state.push_proposals))throw new Error('CHAIR_PUSH_PROPOSALS_INVALID');
  if(state.rejected_push_memory!==undefined&&!Array.isArray(state.rejected_push_memory))throw new Error('CHAIR_REJECTED_PUSH_MEMORY_INVALID');
  assertSha(state.target_sha,'STATE_TARGET_SHA');
  if(!['IDLE','ACTIVE','STALE','LOCKED'].includes(state.repository_state))throw new Error('CHAIR_REPOSITORY_STATE_INVALID');
  for(const id of Object.keys(CHAIR_DEFINITIONS)){
    const chair=state.chairs?.[id];
    if(id==='chair_1'){
      chair.owner_agent_id=chair.owner_agent_id??CHAIR1_OWNER_AGENT;
      chair.owner_role=chair.owner_role??CHAIR1_OWNER_AGENT;
      chair.custody_status=chair.custody_status??'OWNER_CUSTODY';
      chair.auto_return_on_task_close=chair.auto_return_on_task_close??true;
      if(chair.owner_agent_id!==CHAIR1_OWNER_AGENT||chair.owner_role!==CHAIR1_OWNER_AGENT)throw new Error('CHAIR1_OWNER_MISMATCH');
      if(chair.auto_return_on_task_close!==true)throw new Error('CHAIR1_AUTO_RETURN_DISABLED');
      if(!['OWNER_CUSTODY','DELEGATED'].includes(String(chair.custody_status)))throw new Error('CHAIR1_CUSTODY_STATE_INVALID');
    }
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
    const chair=state.chairs[chairId];
    if(chair.status!=='VACANT')throw new Error(chairId==='chair_1'?'CHAIR1_ACTIVE_DELEGATION':'CHAIR_NOT_VACANT');
    if((chairId==='chair_3')&&!reviewId)throw new Error('CHAIR3_ARCHITECTURE_REVIEW_ID_REQUIRED');
    const wp=workPackageId===null?null:assertContextId(workPackageId,'WORK_PACKAGE_ID');
    const task=taskId===null?null:assertContextId(taskId,'TASK_ID');
    if(chairId==='chair_1'){
      if(agentId!==CHAIR1_OWNER_AGENT) verifyCentralChairForMutation({agentId,targetSha:t,workPackageId:wp,taskId:task});
      if(agentId!==CHAIR1_OWNER_AGENT && (task===null || wp===null))throw new Error('CHAIR1_TASK_DELEGATION_REQUIRED');
      if(repositoryState!=='IDLE'||state.repository_state!=='IDLE')throw new Error('CHAIR_REPOSITORY_NOT_IDLE');
      if(active.length)throw new Error('CHAIR1_ACTIVE_DELEGATION');
    }else if(state.repository_state==='STALE'||state.repository_state==='LOCKED'){
      throw new Error('CHAIR_REPOSITORY_NOT_AVAILABLE');
    }
    const fence=fencingToken===null?null:assertFence(fencingToken);
    if(chairId==='chair_1' && process.env.FLIXO_REQUIRE_FENCED_CHAIR==='true' && (!wp||!task||!fence))throw new Error('CHAIR1_MUTATION_CONTEXT_REQUIRED');
    const leaseInput={chairId,agentId,targetSha:t,permissions:CHAIR_DEFINITIONS[chairId].permissions,reviewId,scope,workPackageId:wp,taskId:task,fencingToken:fence};
    chair.holder_agent_id=agentId;chair.holder_role=String(agentId);chair.status='OCCUPIED';chair.acquired_at=now();chair.lease_started_at=chair.acquired_at;chair.heartbeat_at=chair.acquired_at;chair.heartbeat_count=0;chair.target_sha=t;chair.lease_id=signLease(leaseInput);chair.review_id=reviewId;chair.scope=scope;chair.scope_hash=scopeDigest(scope);chair.work_package_id=wp;chair.task_id=task;chair.fencing_token=fence;
    if(chairId==='chair_1'){
      chair.owner_agent_id=CHAIR1_OWNER_AGENT;
      chair.owner_role=CHAIR1_OWNER_AGENT;
      chair.custody_status=agentId===CHAIR1_OWNER_AGENT?'OWNER_CUSTODY':'DELEGATED';
      chair.delegation_id=agentId===CHAIR1_OWNER_AGENT?null:hash(JSON.stringify({agentId,taskId:task,workPackageId:wp,targetSha:t,leaseId:chair.lease_id}));
      chair.delegated_by=agentId===CHAIR1_OWNER_AGENT?null:CHAIR1_OWNER_AGENT;
      chair.delegated_at=agentId===CHAIR1_OWNER_AGENT?null:chair.acquired_at;
      chair.auto_return_on_task_close=true;
      chair.returned_at=null;
      chair.return_reason=null;
    }
    atomicChairRefAudit({chairId,targetSha:t,event:'ACQUIRE'});
    state.repository_state='ACTIVE';state.idle_timestamp=null;writeState(state);return state;
  });
}
export function takeChair1({agentId,targetSha=sha(),reviewId=null,scope=null,workPackageId=null,taskId=null,fencingToken=null}={}) {
  assertAgent(agentId);
  const t=assertSha(targetSha,'TARGET_SHA');
  if(t!==sha())throw new Error('STALE_CONTEXT');
  if(agentId===CHAIR1_OWNER_AGENT){
    return acquire({chairId:'chair_1',agentId,targetSha:t,repositoryState:'IDLE',reviewId,scope,workPackageId,taskId,fencingToken});
  }
  const state=readState();
  if(state.target_sha!==t)throw new Error('CHAIR_STATE_SHA_MISMATCH');
  const chair=state.chairs.chair_1;
  if(chair.status==='OCCUPIED'){
    if(chair.holder_agent_id===agentId){
      verifyCentralChairForMutation({agentId,targetSha:t,workPackageId:chair.work_package_id??workPackageId,taskId:chair.task_id??taskId});
      return Object.freeze({admitted:true,reused:true,preempted:false,chairId:'chair_1',leaseId:chair.lease_id,targetSha:t,taskId:chair.task_id??null,workPackageId:chair.work_package_id??null,ownerAgentId:CHAIR1_OWNER_AGENT,custodyStatus:'DELEGATED'});
    }
    throw new Error('CHAIR1_ACTIVE_DELEGATION');
  }
  if(taskId===null||workPackageId===null)throw new Error('CHAIR1_TASK_DELEGATION_REQUIRED');
  return acquire({chairId:'chair_1',agentId,targetSha:t,repositoryState:'IDLE',reviewId,scope,workPackageId,taskId,fencingToken});
}

export const preemptChair1ForMaster = () => {
  throw new Error('CHAIR1_PREEMPTION_FORBIDDEN_USE_CONTROLLER_RECLAIM');
};

export function reclaimChair1({agentId=CHAIR1_OWNER_AGENT,targetSha=sha(),reason='',userCommandProof='',userCommandSignature=''}={}) {
  assertAgent(agentId);
  if(agentId!==CHAIR1_OWNER_AGENT)throw new Error('CHAIR1_RECLAIM_CONTROLLER_ONLY');
  const normalizedReason=String(reason).trim();
  if(!/^USER_DIRECT_COMMAND(?:[: ]|$)/u.test(normalizedReason))throw new Error('CHAIR1_RECLAIM_REQUIRES_USER_DIRECT_COMMAND');
  const t=assertSha(targetSha,'TARGET_SHA');
  const proof=String(userCommandProof??'').trim();
  const signature=String(userCommandSignature??'').trim();
  const commandKey=String(process.env.FLIXO_USER_COMMAND_SIGNING_KEY??'').trim();
  if(proof!=='USER_DIRECT_COMMAND')throw new Error('CHAIR1_RECLAIM_USER_COMMAND_PROOF_REQUIRED');
  if(!commandKey)throw new Error('CHAIR1_RECLAIM_USER_COMMAND_KEY_REQUIRED');
  if(!HASH_RE.test(signature))throw new Error('CHAIR1_RECLAIM_USER_COMMAND_SIGNATURE_INVALID');
  const expected=createHmac('sha256',commandKey).update(`${t}:${normalizedReason}`,'utf8').digest('hex');
  if(!timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(expected,'hex')))throw new Error('CHAIR1_RECLAIM_USER_COMMAND_SIGNATURE_INVALID');
  if(t!==sha())throw new Error('STALE_CONTEXT');
  return withWriteLock(()=>{
    const state=readState();
    if(state.target_sha!==t)throw new Error('CHAIR_STATE_SHA_MISMATCH');
    const chair=state.chairs.chair_1;
    if(chair.status!=='OCCUPIED')return Object.freeze({reclaimed:false,chairId:'chair_1',ownerAgentId:CHAIR1_OWNER_AGENT,custodyStatus:chair.custody_status??'OWNER_CUSTODY'});
    const displaced={agentId:chair.holder_agent_id,taskId:chair.task_id??null,workPackageId:chair.work_package_id??null,leaseId:chair.lease_id,targetSha:t};
    clearChairRecord(chair,state);
    atomicChairRefAudit({chairId:'chair_1',targetSha:t,event:'USER_DIRECT_COMMAND_RECLAIM'});
    state.last_reclaim={...displaced,ownerAgentId:CHAIR1_OWNER_AGENT,reason:String(reason).trim(),at:now()};
    writeState(state);
    return Object.freeze({reclaimed:true,chairId:'chair_1',ownerAgentId:CHAIR1_OWNER_AGENT,custodyStatus:'OWNER_CUSTODY',displaced});
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
  verifyCentralChairForMutation({agentId,targetSha:t,workPackageId,taskId});
  const def=CHAIR_DEFINITIONS[chairId];
  if(chair.work_package_id!==null && chair.work_package_id!==String(workPackageId??''))throw new Error('CHAIR_WORK_PACKAGE_MISMATCH');
  if(chair.task_id!==null && chair.task_id!==String(taskId??''))throw new Error('CHAIR_TASK_MISMATCH');
  if(chair.fencing_token!==null && chair.fencing_token!==String(fencingToken??''))throw new Error('CHAIR_FENCING_TOKEN_MISMATCH');
  if(chair.scope_hash!==null && chair.scope_hash!==scopeDigest(paths))throw new Error('CHAIR_SCOPE_HASH_MISMATCH');
  if(!def.permissions.includes(permission))throw new Error('CHAIR_PERMISSION_DENIED='+permission);
  if(chairId==='chair_1'){
    if(chair.owner_agent_id!==CHAIR1_OWNER_AGENT)throw new Error('CHAIR1_OWNER_MISSING');
    if(chair.custody_status!=='DELEGATED' && agentId!==CHAIR1_OWNER_AGENT)throw new Error('CHAIR1_NOT_DELEGATED');
    if(permission==='MERGE_PROPOSAL')throw new Error('MERGE_PROPOSAL_IS_NOT_MERGE_AUTHORITY');
  }
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
  }
  return Object.freeze({authorized:true,chairId,agentId,targetSha:t,permission,paths:normalized,mode:def.mode,singleAgentMode:chairId==='chair_1'&&occupied(state).length===1});
}
export function authorizePublication({chairId='chair_1',agentId,targetSha=sha(),paths=[],permission='SOURCE_MUTATION',workPackageId=null,taskId=null,fencingToken=null}={}) {
  if(!Array.isArray(paths)||paths.length===0)throw new Error('CHAIR_WRITE_PATHS_REQUIRED');
  const t=assertSha(targetSha,'TARGET_SHA');
  const state=readState();
  if(state.target_sha!==t)throw new Error('STALE_CONTEXT');
  const chair=verifyLease({state,chairId,agentId,targetSha:t,assertCurrentHead:false});
  verifyCentralChairForMutation({agentId,targetSha:t,workPackageId,taskId});
  const def=CHAIR_DEFINITIONS[chairId];
  if(!def.permissions.includes(permission))throw new Error('CHAIR_PERMISSION_DENIED='+permission);
  if(chair.work_package_id!==null && chair.work_package_id!==String(workPackageId??''))throw new Error('CHAIR_WORK_PACKAGE_MISMATCH');
  if(chair.task_id!==null && chair.task_id!==String(taskId??''))throw new Error('CHAIR_TASK_MISMATCH');
  if(chair.fencing_token!==null && chair.fencing_token!==String(fencingToken??''))throw new Error('CHAIR_FENCING_TOKEN_MISMATCH');
  const normalized=[...new Set(paths.map(p=>String(p).replaceAll('\\','/').replace(/^\.\//,'').trim()).filter(Boolean))].sort();
  if(normalized.some(p=>p==='*'))throw new Error('CHAIR_PUBLICATION_WILDCARD_FORBIDDEN');
  if(chair.scope_hash!==null && chair.scope_hash!==scopeDigest(normalized))throw new Error('CHAIR_SCOPE_HASH_MISMATCH');
  if(chair.work_package_id!==null && chair.work_package_id!==String(workPackageId??''))throw new Error('CHAIR_WORK_PACKAGE_MISMATCH');
  if(chair.task_id!==null && chair.task_id!==String(taskId??''))throw new Error('CHAIR_TASK_MISMATCH');
  if(chair.fencing_token!==null && chair.fencing_token!==String(fencingToken??''))throw new Error('CHAIR_FENCING_TOKEN_MISMATCH');
  if(chairId==='chair_1'){
    if(chair.owner_agent_id!==CHAIR1_OWNER_AGENT)throw new Error('CHAIR1_OWNER_MISSING');
    if(chair.custody_status!=='DELEGATED' && agentId!==CHAIR1_OWNER_AGENT)throw new Error('CHAIR1_NOT_DELEGATED');
  }
  for(const p of normalized){
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
  summary='',
  pushDetails=null
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
  const details = pushDetails && typeof pushDetails==='object' && !Array.isArray(pushDetails) ? pushDetails : {};
  const requiredPushDetails=['pushId','actorAgent','actorRole','sessionId','event','reason','changeType','repository','branch','commitMessage','commitTreeSha','requestedAt'];
  for(const field of requiredPushDetails){
    if(String(details[field]??'').trim()==='')throw new Error('CHAIR_PUSH_DETAILS_REQUIRED='+field);
  }
  if(String(details.actorAgent)!==agentId)throw new Error('CHAIR_PUSH_DETAILS_ACTOR_MISMATCH');
  if(String(details.event)!=='PUSH')throw new Error('CHAIR_PUSH_DETAILS_EVENT_INVALID');
  if(!HASH_RE.test(String(patchSha256??'')))throw new Error('CHAIR_PUSH_PATCH_SHA_REQUIRED');
  if(!HASH_RE.test(String(details.commitTreeSha)))throw new Error('CHAIR_PUSH_COMMIT_TREE_SHA_REQUIRED');
  const proposalId=hash(JSON.stringify({chairId,agentId,targetSha:t,candidateSha:candidate,parentSha:parent,paths:normalized,workPackageId:wp,taskId:task,patchSha256:String(patchSha256),pushDetails:details}));
  return withWriteLock(()=>{
    const fresh=readState();
    if(fresh.target_sha!==t)throw new Error('STALE_CONTEXT');
    const proposal={
      schemaVersion:1,
      protocol:'FLIXO-CHAIR-PUSH-PROPOSAL-v2',
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
      patchSha256:String(patchSha256),
      summary:String(summary??'').slice(0,4000),
      pushDetails:{
        pushId:String(details.pushId),
        actorAgent:String(details.actorAgent),
        actorRole:String(details.actorRole),
        sessionId:String(details.sessionId),
        event:String(details.event),
        reason:String(details.reason).slice(0,1000),
        changeType:String(details.changeType),
        repository:String(details.repository),
        branch:String(details.branch),
        commitMessage:String(details.commitMessage).slice(0,4000),
        commitTreeSha:String(details.commitTreeSha),
        requestedAt:String(details.requestedAt),
        expectedRemoteSha:t,
        candidateSha:candidate,
        parentSha:parent
      },
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
export function recordControllerPushDecision({
  proposalId,
  decision,
  reasonCode,
  controllerAgent=CHAIR1_OWNER_AGENT,
  currentSha=sha(),
  validationEvidence=null
}={}){
  const id=assertContextId(proposalId,'PROPOSAL_ID');
  const actor=String(controllerAgent??'').trim();
  if(actor!==CHAIR1_OWNER_AGENT)throw new Error('PUSH_DECISION_CONTROLLER_ONLY');
  const verdict=String(decision??'').trim().toUpperCase();
  if(!['ACCEPTED','REJECTED'].includes(verdict))throw new Error('PUSH_CONTROLLER_DECISION_INVALID');
  const t=assertSha(currentSha,'CURRENT_SHA');
  if(t!==sha())throw new Error('STALE_CONTEXT');
  const reason=assertContextId(reasonCode||'UNSPECIFIED','REASON_CODE');
  return withWriteLock(()=>{
    const state=readState();
    const idx=(state.push_proposals??[]).findIndex((p)=>p.proposalId===id);
    if(idx<0)throw new Error('CHAIR_PUSH_PROPOSAL_NOT_FOUND');
    const proposal=state.push_proposals[idx];
    if(proposal.targetSha!==t)throw new Error('CHAIR_PUSH_PROPOSAL_STALE');
    const report=validationEvidence??null;
    if(verdict==='ACCEPTED' && (report?.authority!=='VALIDATION_ONLY' || report?.validationStatus!=='PASS'))throw new Error('PUSH_CONTROLLER_ACCEPT_REQUIRES_VALIDATION_PASS');
    if(verdict==='ACCEPTED'){
      if(report?.proposalId!==id)throw new Error('PUSH_CONTROLLER_VALIDATION_PROPOSAL_MISMATCH');
      if(report?.currentSha!==t||proposal.targetSha!==t)throw new Error('PUSH_CONTROLLER_VALIDATION_SHA_MISMATCH');
      if(report?.candidateSha!==proposal.candidateSha||report?.parentSha!==proposal.parentSha)throw new Error('PUSH_CONTROLLER_VALIDATION_COMMIT_MISMATCH');
      if(String(report?.taskId??'')!==String(proposal.taskId??'')||String(report?.workPackageId??'')!==String(proposal.workPackageId??''))throw new Error('PUSH_CONTROLLER_VALIDATION_CONTEXT_MISMATCH');
    }
    const decisionRecord={
      decision:verdict,
      authority:CHAIR1_OWNER_AGENT,
      reasonCode:reason,
      currentSha:t,
      validationEvidence:report,
      decidedAt:now()
    };
    proposal.status=`CONTROLLER_${verdict}`;
    proposal.controllerDecision=decisionRecord;
    proposal.guardDecision=null;
    if(verdict==='REJECTED'){
      state.rejected_push_memory=Array.isArray(state.rejected_push_memory)?state.rejected_push_memory.slice(-499):[];
      state.rejected_push_memory.push({
        schemaVersion:1,
        protocol:'FLIXO-REJECTED-PUSH-MEMORY-v2',
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
        validationEvidence:report,
        reusableAfter:'ASSISTANT_CONTROLLER_REQUIRES_CURRENT_EXACT_SHA_AND_NEW_DECISION',
        createdAt:proposal.createdAt,
        rejectedAt:now()
      });
    }
    writeState(state);
    return Object.freeze({
      proposal,
      status:proposal.status,
      decision:decisionRecord,
      controllerAgent:CHAIR1_OWNER_AGENT,
      rejectedPushMemory:verdict==='REJECTED'?state.rejected_push_memory.at(-1):null
    });
  });
}

export function recordRejectedPushValidation({proposalId,currentSha=sha(),validationEvidence=null,reasonCode='CHAIR_GUARD_VALIDATION_FAILED'}={}){
  const id=assertContextId(proposalId,'PROPOSAL_ID');
  const t=assertSha(currentSha,'CURRENT_SHA');
  if(t!==sha())throw new Error('STALE_CONTEXT');
  if(validationEvidence?.authority!=='VALIDATION_ONLY'||validationEvidence?.validationStatus!=='FAIL')throw new Error('REJECTED_PUSH_VALIDATION_EVIDENCE_INVALID');
  if(validationEvidence?.proposalId!==id)throw new Error('REJECTED_PUSH_VALIDATION_PROPOSAL_MISMATCH');
  return withWriteLock(()=>{
    const state=readState();
    const idx=(state.push_proposals??[]).findIndex((p)=>p.proposalId===id);
    if(idx<0)throw new Error('CHAIR_PUSH_PROPOSAL_NOT_FOUND');
    const proposal=state.push_proposals[idx];
    if(proposal.targetSha!==t)throw new Error('CHAIR_PUSH_PROPOSAL_STALE');
    state.rejected_push_memory=Array.isArray(state.rejected_push_memory)?state.rejected_push_memory.slice(-499):[];
    const record={schemaVersion:1,protocol:'FLIXO-REJECTED-PUSH-MEMORY-v2',authority:'VALIDATION_ONLY',memoryId:hash(JSON.stringify({proposalId:id,currentSha:t,reasonCode})),proposalId:id,proposerChair:proposal.proposerChair,proposerAgent:proposal.proposerAgent,targetSha:proposal.targetSha,parentSha:proposal.parentSha,candidateSha:proposal.candidateSha,workPackageId:proposal.workPackageId,taskId:proposal.taskId,paths:proposal.paths,patchSha256:proposal.patchSha256,reasonCode,summary:proposal.summary,validationEvidence:validationEvidence,reusableAfter:'ASSISTANT_CONTROLLER_REQUIRES_CURRENT_EXACT_SHA_AND_NEW_DECISION',createdAt:proposal.createdAt,rejectedAt:now()};
    if(!state.rejected_push_memory.some((item)=>item.memoryId===record.memoryId))state.rejected_push_memory.push(record);
    writeState(state);
    return Object.freeze({record,targetSha:t,proposalId:id,authority:'VALIDATION_ONLY'});
  });
}
export function recordGuardDecision(args={}){
  if(String(args.guardAgent??'').trim()!==CHAIR1_OWNER_AGENT)throw new Error('PUSH_DECISION_CONTROLLER_ONLY');
  return recordControllerPushDecision({
    proposalId:args.proposalId,
    decision:args.decision,
    reasonCode:args.reasonCode,
    controllerAgent:CHAIR1_OWNER_AGENT,
    currentSha:args.currentSha,
    validationEvidence:args.guardEvidence
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
    verifyCentralChairForMutation({agentId,targetSha:t,workPackageId:chair.work_package_id??null,taskId:taskId??chair.task_id??null});
    assertChair1ReleaseAllowed(chair,{successful,reason:successful===true?'TASK_COMPLETE':'RELEASE'});
    if(chairId==='chair_1' && successful===true) releaseCentralChair({agentId,targetSha:t,workPackageId:chair.work_package_id??null,taskId:taskId??chair.task_id??null});
    if(sessionId)sanitizeSessionContext({sessionId,taskId});
    const wasChair1=chairId==='chair_1';
    if(wasChair1 && chair.auto_return_on_task_close!==true)throw new Error('CHAIR1_AUTO_RETURN_DISABLED');
    clearChairRecord(chair,state);
    atomicChairRefAudit({chairId,targetSha:t,event:'RELEASE'});
    if(wasChair1){
      state.last_chair1_return={chairId:'chair_1',ownerAgentId:CHAIR1_OWNER_AGENT,returnedFromAgentId:agentId,taskId:taskId??null,successful:Boolean(successful),reason:successful===true?'TASK_COMPLETE':'TASK_RELEASE',at:now(),targetSha:t,custodyStatus:'OWNER_CUSTODY'};
    }
    if(successful===true&&state.repository_state==='ACTIVE')state.repository_state='ACTIVE';
    writeState(state);return state;
  });
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

export function preemptedContinuityForAgent({agentId,targetSha=sha(),taskId=null}={}){
  assertAgent(agentId);
  const t=assertSha(targetSha,'TARGET_SHA');
  if(t!==sha())throw new Error('STALE_CONTEXT');
  const state=readState();
  const history=Array.isArray(state.preemption_history)?state.preemption_history:[];
  const candidates=[...(state.last_preemption ? [state.last_preemption] : []),...history]
    .filter((item)=>item?.status==='CONTINUING_AFTER_PREEMPTION'
      && item.targetSha===t
      && item.displacedAgentId===agentId
      && (taskId===null || taskId===undefined || String(item.displacedTaskId??'')===String(taskId)))
    .sort((a,b)=>Date.parse(String(b.at??''))-Date.parse(String(a.at??'')));
  const preemption=candidates[0]??null;
  if(!preemption)return null;
  return Object.freeze({
    continuity:true,
    status:preemption.status,
    authority:preemption.authority,
    agentId,
    taskId:preemption.displacedTaskId??null,
    workPackageId:preemption.displacedWorkPackageId??null,
    targetSha:t,
    mutationAuthorityRevoked:true,
    canContinueTask:true,
    canMutateAfterPreemption:false,
    handoffTo:preemption.mustHandoffTo,
    preemptedAt:preemption.at
  });
}

export function assertWorkAdmission({agentId,targetSha=sha(),chairId=null,taskId=null}={}){
  const active=activeChairForAgent({agentId,targetSha});
  if(!active){
    const continuity=preemptedContinuityForAgent({agentId,targetSha,taskId});
    if(continuity)return continuity;
    throw new Error('AGENT_WORK_REQUIRES_CHAIR');
  }
  if(chairId&&active.chairId!==chairId)throw new Error('AGENT_WORK_CHAIR_MISMATCH');
  return active;
}

function stateRepositoryOccupiedForTakeover(targetSha){
  const t=assertSha(targetSha,'TARGET_SHA');
  const state=readState();
  if(state.target_sha!==t)throw new Error('CHAIR_STATE_SHA_MISMATCH');
  return state.repository_state==='ACTIVE' && Object.values(state.chairs).some((chair)=>chair.status==='OCCUPIED');
}

export function beginWork({agentId,targetSha=sha(),requestedChairId=null,repositoryState='IDLE',workPackageId=null,taskId=null,fencingToken=null,scope=null,reviewId=null,role=null}={}){
  assertAgent(agentId);
  const t=assertSha(targetSha,'TARGET_SHA');
  if(t!==sha())throw new Error('STALE_CONTEXT');
  const existing=activeChairForAgent({agentId,targetSha:t});
  if(existing)return Object.freeze({admitted:true,reused:true,...existing});
  const continuity=preemptedContinuityForAgent({agentId,targetSha:t,taskId});
  if(continuity)return Object.freeze({admitted:true,reused:false,continuity:true,chairId:null,leaseId:null,targetSha:t,taskId:continuity.taskId,workPackageId:continuity.workPackageId,authority:continuity.authority,mutationAuthorityRevoked:true,canContinueTask:true,canMutateAfterPreemption:false,handoffTo:continuity.handoffTo});
  const chairId=String(requestedChairId??'chair_1').trim()||'chair_1';
  if(chairId!=='chair_1' && chairId!=='chair_2' && chairId!=='chair_3')throw new Error('CHAIR_UNKNOWN');
  if(chairId!=='chair_1')throw new Error('CHAIR_AUTO_ADMISSION_MUST_USE_CHAIR_1');
  if(requestedChairId==='chair_1' && stateRepositoryOccupiedForTakeover(t)){
    return takeChair1({agentId,targetSha:t,role,repositoryState:'ACTIVE',workPackageId,taskId,fencingToken,scope,reviewId,reason:'AGENT_REQUESTED_CHAIR_1'});
  }
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
  const chair1=state.chairs.chair_1;
  return {
    repositoryState:state.repository_state,
    chair1Owner:CHAIR1_OWNER_AGENT,
    chair1CustodyStatus:chair1.custody_status??'OWNER_CUSTODY',
    chair1AutoReturn:chair1.auto_return_on_task_close===true,
    activeChairs:occupied(state).map(([id,c])=>({chairId:id,holderAgentId:c.holder_agent_id,targetSha:c.target_sha,mode:CHAIR_DEFINITIONS[id].mode,ownerAgentId:c.owner_agent_id??null,custodyStatus:c.custody_status??null})),
    singleAgentMode:occupied(state).length===1&&occupied(state).some(([id])=>id==='chair_1')
  };
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
  else if(command==='controller-decision'){
    const evidenceText=arg('evidence')||'';
    let evidence=null;
    if(evidenceText){try{evidence=JSON.parse(evidenceText);}catch{throw new Error('PUSH_CONTROLLER_VALIDATION_EVIDENCE_INVALID');}}
    console.log(JSON.stringify(recordControllerPushDecision({proposalId:arg('proposal-id'),decision:arg('decision'),reasonCode:arg('reason'),controllerAgent:arg('controller','assistantController'),currentSha:target,validationEvidence:evidence}),null,2));
  }
  else if(command==='guard-decision')throw new Error('PUSH_DECISION_CONTROLLER_ONLY');
  else if(command==='release')console.log(JSON.stringify(release({chairId:arg('chair','chair_1'),agentId:arg('agent'),targetSha:target,successful:arg('successful','false')==='true'}),null,2));
  else if(command==='mode')console.log(JSON.stringify(repositoryMode({targetSha:target}),null,2));
  else if(command==='validate')console.log(JSON.stringify(validateCurrent({chairId:arg('chair','chair_1'),agentId:arg('agent'),targetSha:target,paths,permission:arg('permission','SOURCE_MUTATION'),reviewId:arg('review-id')||null,boundedScope:scope.length?scope:null}),null,2));
  else if(command==='heartbeat')console.log(JSON.stringify(heartbeat({chairId:arg('chair','chair_1'),agentId:arg('agent'),targetSha:target}),null,2));
  else if(command==='reconcile-dead-leases')console.log(JSON.stringify(reconcileDeadLeases({targetSha:target}),null,2));
  else if(command==='take-chair')console.log(JSON.stringify(takeChair1({agentId:arg('agent'),role:arg('role')||null,targetSha:target,repositoryState:arg('repository-state','ACTIVE'),workPackageId:arg('work-package')||null,taskId:arg('task-id')||null,fencingToken:arg('fencing-token')||null,scope:scope.length?scope:null,reviewId:arg('review-id')||null,reason:arg('reason','AGENT_NEEDS_CHAIR_1')}),null,2));
  else if(command==='master-preempt')throw new Error('CHAIR1_PREEMPTION_FORBIDDEN_USE_CONTROLLER_RECLAIM');
  else if(command==='reclaim-chair')console.log(JSON.stringify(reclaimChair1({agentId:arg('agent','assistantController'),targetSha:target,reason:arg('reason'),userCommandProof:arg('user-command-proof'),userCommandSignature:arg('user-command-signature')}),null,2));
  else if(command==='speculate')console.log(JSON.stringify(writeSpeculativeContext({sessionId:arg('session'),taskId:arg('task'),chairId:arg('chair'),role:arg('role'),targetSha:target,pendingDiff:arg('pending-diff'),testPlan:arg('test-plan').split(';').map(v=>v.trim()).filter(Boolean)}),null,2));
  else throw new Error('Usage: chair-bound-execution.mjs init|acquire|authorize-write|merge-proposal|release|mode|validate');
}