#!/usr/bin/env node
import { publishSharedMemory, loadSharedMemory, SHARED_KINDS } from './shared-operational-memory.mjs';

const SHA40=/^[a-f0-9]{40}$/u;
const SHA256=/^[a-f0-9]{64}$/u;
const repoSha=String(process.env.FLIXO_TARGET_SHA??process.env.VERCEL_GIT_COMMIT_SHA??process.env.GITHUB_SHA??'').trim();
if(!SHA40.test(repoSha)) throw new Error('COGNITIVE_MESH_TARGET_SHA_REQUIRED');

const config=()=>({
  url:String(process.env.SUPABASE_URL??'').trim().replace(/\/$/u,''),
  key:String(process.env.SUPABASE_SERVICE_ROLE_KEY??process.env.SUPABASE_SECRET_KEY??'').trim(),
});
const cfg=config();
const enabled=Boolean(cfg.url&&cfg.key);
const limit=Math.min(128,Math.max(1,Number(process.env.FLIXO_COGNITIVE_MESH_LIMIT??96)||96));

async function rest(path,init={}){
  if(!enabled) return null;
  const response=await fetch(cfg.url+path,{
    ...init,
    headers:{
      apikey:cfg.key,
      Authorization:`Bearer ${cfg.key}`,
      Accept:'application/json',
      ...(init.headers??{}),
    },
    signal:init.signal??AbortSignal.timeout(3000),
  });
  const text=await response.text();
  if(!response.ok) throw new Error(`COGNITIVE_MESH_SUPABASE_HTTP_${response.status}`);
  return text?JSON.parse(text):null;
}

const remoteCandidates=enabled
  ? await rest(`/rest/v1/flixo_agent_learning_events?target_sha=eq.${encodeURIComponent(repoSha)}&status=eq.PROPOSED&select=*&order=created_at.desc&limit=${limit}`)
  : [];

let imported=0;
let duplicates=0;
for(const item of Array.isArray(remoteCandidates)?remoteCandidates:[]){
  if(!item||!SHA40.test(String(item.target_sha??''))||String(item.target_sha)!==repoSha||!SHA256.test(String(item.fingerprint??''))) continue;
  const kind=String(item.kind??'');
  if(!SHARED_KINDS.includes(kind)) continue;
  const result=publishSharedMemory({
    sourceBot:'execution-agent-clone-v1',
    authenticatedSourceBot:'execution-agent-clone-v1',
    kind,
    status:'PROPOSED',
    taskId:String(item.task_id??'').trim()||'EXTERNAL-AGENT-LEARNING',
    targetSha:repoSha,
    fingerprint:String(item.fingerprint),
    claim:String(item.claim??'').slice(0,8000),
    content:String(item.content??item.claim??'').slice(0,16000),
    evidenceRefs:Array.isArray(item.evidence_refs)?item.evidence_refs.slice(0,32):[],
    verification:'EXTERNAL_AGENT_LEARNING_INGRESS',
    canonicalGreen:false,
    advice:kind==='ADVICE'?String(item.claim??''):null,
    antiLesson:kind==='ANTI_LESSON',
  });
  if(result.duplicate) duplicates+=1; else imported+=1;
}

const memory=loadSharedMemory();
const mirrorable=memory.records
  .filter(record=>record.targetSha===repoSha&&['VERIFIED','PROMOTED'].includes(String(record.status))&&record.canonicalGreen===true&&SHARED_KINDS.includes(record.kind))
  .slice(0,limit);

let mirrored=0;
if(enabled){
  for(const record of mirrorable){
    const payload={
      source_agent:String(record.sourceBot),
      source_role:String(record.sourceBot),
      kind:String(record.kind),
      status:String(record.status),
      task_id:String(record.taskId),
      target_sha:repoSha,
      claim:String(record.claim).slice(0,8000),
      content:String(record.content||record.claim).slice(0,16000),
      evidence_refs:Array.isArray(record.evidenceRefs)?record.evidenceRefs.slice(0,32):[],
      provenance:{
        mirroredFrom:'diagnostics/auto-repair/SHARED-OPERATIONAL-MEMORY.json',
        sharedMemoryId:record.id,
        exactSha:repoSha,
      },
      fingerprint:String(record.fingerprint),
      canonical_green:true,
    };
    const result=await rest('/rest/v1/flixo_agent_learning_events?on_conflict=fingerprint',{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        Prefer:'return=minimal,resolution=ignore-duplicates',
      },
      body:JSON.stringify(payload),
    });
    void result;
    mirrored+=1;
  }
}

console.log(JSON.stringify({
  protocol:'FLIXO-BIDIRECTIONAL-COGNITIVE-MESH-v1',
  targetSha:repoSha,
  enabled,
  imported,
  duplicates,
  mirrored,
  remoteCandidateCount:Array.isArray(remoteCandidates)?remoteCandidates.length:0,
},null,2));
