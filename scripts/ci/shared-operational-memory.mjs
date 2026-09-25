#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT=process.cwd();
export const SHARED_MEMORY_PATH=path.resolve(ROOT,process.env.FLIXO_SHARED_OPERATIONAL_MEMORY??'diagnostics/auto-repair/SHARED-OPERATIONAL-MEMORY.json');
export const SHARED_MEMORY_PROTOCOL='FLIXO-SHARED-OPERATIONAL-MEMORY-v1';
export const CELL_MEMORY_SCOPE='ALL_CELL_MEMBERS';
export const CELL_MEMBER_COUNT=200;
export const SHARED_MEMORY_MODEL='ONE_CANONICAL_MEMORY';
export const FLIXO_UNIFIED_COGNITIVE_KERNEL='FLIXO-UNIFIED-COGNITIVE-KERNEL-v2';
export const OVER_PROVISIONED_COGNITION=true;
export const SYSTEM_WIDE_MEMORY_SCOPE='ALL_INTERNAL_AGENTS_AND_REPAIR_BOTS';
export const FLIXO_BOT_REGISTRY_PATH=path.resolve(ROOT,process.env.FLIXO_BOT_REGISTRY??'docs/agents/FLIXO-BOT.json');
const loadFlixoBotAudience=()=>{try{const registry=JSON.parse(fs.readFileSync(FLIXO_BOT_REGISTRY_PATH,'utf8'));const audience=registry?.distribution?.learningConsumers;const cognitiveIds=registry?.distribution?.cognitiveBotIds;if(!Array.isArray(cognitiveIds)||cognitiveIds.length!==200)throw new Error('INVALID_COGNITIVE_AUDIENCE');if(!Array.isArray(audience)||audience.length!==200||JSON.stringify(audience)!==JSON.stringify(cognitiveIds))throw new Error('INVALID_GLOBAL_AUDIENCE');return [...new Set(audience.map(x=>String(x).trim()).filter(Boolean))];}catch(error){if(process.env.NODE_ENV==='test'||process.env.FLIXO_ALLOW_LEGACY_SHARED_MEMORY_FALLBACK==='true')return ['ACTION-REPAIR','ACTION-REPAIR-2','READ-INVESTIGATOR','READ-ADVERSARY','executionAgent','reviewAgent'];throw new Error('FLIXO_BOT_GLOBAL_MEMORY_AUDIENCE_UNAVAILABLE:'+error.message,{cause:error});}};
export const SHARED_BOTS=Object.freeze(loadFlixoBotAudience());
if(SHARED_BOTS.length!==CELL_MEMBER_COUNT) throw new Error('CELL_SHARED_MEMORY_MEMBER_COUNT_INVALID');
const loadFlixoBotAliases=()=>{try{const registry=JSON.parse(fs.readFileSync(FLIXO_BOT_REGISTRY_PATH,'utf8'));return Object.freeze({...registry?.distribution?.botAliasMap});}catch(error){if(process.env.NODE_ENV==='test'||process.env.FLIXO_ALLOW_LEGACY_SHARED_MEMORY_FALLBACK==='true')return Object.freeze({});throw new Error('FLIXO_BOT_ALIAS_MAP_UNAVAILABLE:'+error.message,{cause:error});}};
export const FLIXO_BOT_ALIASES=loadFlixoBotAliases();
export function resolveSharedMemoryBotId(botId){const id=String(botId??'').trim();const canonical=SHARED_BOTS.includes(id)?id:FLIXO_BOT_ALIASES[id];if(!canonical||!SHARED_BOTS.includes(canonical))throw new Error('SHARED_MEMORY_BOT_INVALID='+id);return canonical;}
export const SHARED_KINDS=Object.freeze([
  'ERROR',
  'OPERATION',
  'ADVICE',
  'OBLIGATION',
  'LESSON',
  'ANTI_LESSON',
  'COUNTEREXAMPLE',
  'VERIFICATION',
]);

const SHA=/^[a-f0-9]{40}$/u;
const LEGACY_MEMORY_PATH=path.resolve(ROOT,'diagnostics/auto-repair/memory.json');
const LEGACY_CELL_INDEX_PATH=path.resolve(ROOT,'diagnostics/auto-repair/cell-knowledge/index.json');
const now=()=>new Date().toISOString();
const hash=(value)=>createHash('sha256').update(String(value),'utf8').digest('hex');
const readJson=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}};
const remoteLearningConfig=()=>({
  url:String(process.env.SUPABASE_URL??'').trim().replace(/\/$/u,''),
  key:String(process.env.SUPABASE_SECRET_KEY??process.env.SUPABASE_SERVICE_ROLE_KEY??'').trim(),
});
async function readRemoteExternalLearning(targetSha,limit=48){
  const cfg=remoteLearningConfig();
  if(!cfg.url||!cfg.key||!validSha(targetSha)) return [];
  const bounded=Math.min(128,Math.max(1,Number(limit)||48));
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),1500);
  try{
    const url=`${cfg.url}/rest/v1/flixo_agent_learning_events?target_sha=eq.${encodeURIComponent(targetSha)}&status=neq.BLOCKED&select=*&order=created_at.desc&limit=${bounded}`;
    const response=await fetch(url,{
      method:'GET',
      headers:{apikey:cfg.key,Authorization:`Bearer ${cfg.key}`,Accept:'application/json'},
      signal:controller.signal,
    });
    if(!response.ok) return [];
    const body=await response.json();
    if(!Array.isArray(body)) return [];
    return body.filter(item=>item&&typeof item==='object'&&validSha(item.target_sha)&&item.target_sha===targetSha&&SHA.test(String(item.fingerprint??''))).map(item=>({
      id:String(item.learning_id??item.fingerprint),
      kind:String(item.kind),
      status:String(item.status??'PROPOSED'),
      claim:String(item.claim??''),
      content:String(item.content??''),
      fingerprint:String(item.fingerprint),
      targetSha:String(item.target_sha),
      sourceBot:String(item.source_agent??'execution-agent-clone-v1'),
      sourceRole:String(item.source_role??'executionAgent'),
      evidenceRefs:Array.isArray(item.evidence_refs)?item.evidence_refs.slice(0,32):[],
      provenance:item.provenance&&typeof item.provenance==='object'?item.provenance:{},
      createdAt:String(item.created_at??''),
      canonicalGreen:item.canonical_green===true,
    })).filter(item=>item.claim||item.content);
  }catch{
    return [];
  }finally{
    clearTimeout(timer);
  }
}

const empty=()=>({
  schemaVersion:2,
  intelligenceRegistry:'docs/agents/FLIXO-BOT.json',
  intelligenceVersion:'FLIXO-BOT-BRAIN-v2',
  protocol:SHARED_MEMORY_PROTOCOL,
  authority:'SHARED_KNOWLEDGE_ONLY',
  mutationAuthority:false,
  certificationAuthority:false,
  canonical:true,
  botCount:SHARED_BOTS.length,
  bots:[...SHARED_BOTS],
  recordCount:0,
  updatedAt:null,
  records:[],
  indexes:{byFingerprint:{},byBot:{},byKind:{}},
  legacyReadThrough:{
    enabled:true,
    sources:[
      'diagnostics/auto-repair/memory.json',
      'diagnostics/auto-repair/cell-knowledge/index.json',
      'diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json',
      'docs/agents/ACTION-ERROR-HISTORY.md',
      'docs/agents/ERROR-TEACHING-ROUTER.json'
    ],
    authority:'CONTEXT_ONLY'
  }
});

const validSha=(value)=>SHA.test(String(value??''));

function ensureParent(){
  fs.mkdirSync(path.dirname(SHARED_MEMORY_PATH),{recursive:true});
}

export function validateSharedMemoryRecord(input={}){
  const failures=[];
  const sourceBot=String(input.sourceBot??'').trim();
  try { resolveSharedMemoryBotId(sourceBot); } catch { failures.push('SOURCE_BOT_INVALID'); }
  if(!SHARED_KINDS.includes(String(input.kind??''))) failures.push('KIND_INVALID');
  if(!validSha(input.targetSha)) failures.push('EXACT_TARGET_SHA_REQUIRED');
  if(!String(input.taskId??'').trim()) failures.push('TASK_ID_REQUIRED');
  if(!String(input.claim??input.content??'').trim()) failures.push('LEARNING_CONTENT_REQUIRED');
  if(input.mutationAuthority===true) failures.push('SHARED_MEMORY_CANNOT_GRANT_MUTATION');
  if(input.certificationAuthority===true) failures.push('SHARED_MEMORY_CANNOT_GRANT_CERTIFICATION');
  const authenticated=String(input.authenticatedSourceBot??process.env.FLIXO_AUTHENTICATED_AGENT_ID??'').trim();
  if(process.env.NODE_ENV!=='test' && process.env.GITHUB_ACTIONS==='true' && (!authenticated || authenticated!==sourceBot)) failures.push('SOURCE_BOT_AUTHENTICATION_REQUIRED');
  const status=String(input.status??'OBSERVED').toUpperCase();
  if(['VERIFIED','PROMOTED'].includes(status) && input.canonicalGreen!==true) failures.push('VERIFIED_MEMORY_REQUIRES_CANONICAL_GREEN');
  return Object.freeze({ok:failures.length===0,failures});
}

function normalizeRecord(input={}){
  const validation=validateSharedMemoryRecord(input);
  if(!validation.ok) throw new Error('SHARED_MEMORY_RECORD_INVALID='+validation.failures.join(','));
  const content=String(input.content??input.claim??'').trim().slice(0,16000);
  const claim=String(input.claim??content).trim().slice(0,8000);
  const id='SM-'+hash([
    input.sourceBot,input.kind,input.taskId,input.fingerprint,input.targetSha,
    input.runId,claim,content
  ].join('|')).slice(0,28);
  const status=String(input.status??'OBSERVED').toUpperCase();
  const allowedStatus=['OBSERVED','PROPOSED','VERIFIED','PROMOTED','BLOCKED','SUPERSEDED'];
  if(!allowedStatus.includes(status)) throw new Error('SHARED_MEMORY_STATUS_INVALID');
  return {
    id,
    protocol:SHARED_MEMORY_PROTOCOL,
    sourceBot:resolveSharedMemoryBotId(input.sourceBot),
    sourceBotAlias:String(input.sourceBot??'').trim() || null,
    memoryModel:SHARED_MEMORY_MODEL,
    cellMemberCount:SHARED_BOTS.length,
    kind:String(input.kind),
    status,
    taskId:String(input.taskId),
    fingerprint:String(input.fingerprint??'')||null,
    runId:String(input.runId??'')||null,
    targetSha:String(input.targetSha),
    failedSha:validSha(input.failedSha)?String(input.failedSha):null,
    rootCause:String(input.rootCause??'')||null,
    operation:String(input.operation??'')||null,
    rule:String(input.rule??'')||null,
    claim,
    content,
    advice:String(input.advice??'')||null,
    obligation:String(input.obligation??'')||null,
    evidenceRefs:Array.isArray(input.evidenceRefs)?input.evidenceRefs.slice(0,64):[],
    changedPaths:Array.isArray(input.changedPaths)?input.changedPaths.slice(0,64):[],
    verification:String(input.verification??'')||null,
    canonicalGreen:input.canonicalGreen===true,
    greenRunId:String(input.greenRunId??'')||null,
    authenticatedSourceBot:String(input.authenticatedSourceBot??process.env.FLIXO_AUTHENTICATED_AGENT_ID??'')||null,
    antiLesson:Boolean(input.antiLesson===true||String(input.kind)==='ANTI_LESSON'),
    source:'SHARED_MEMORY_WRITE',
    intelligenceRegistry:'docs/agents/FLIXO-BOT.json',
    intelligenceVersion:'FLIXO-BOT-BRAIN-v2',
    exactShaBound:true,
    mutationAuthority:false,
    certificationAuthority:false,
    createdAt:now(),
  };
}

function withIndexes(memory){
  const next={...empty(),...memory,records:Array.isArray(memory?.records)?memory.records:[]};
  next.botCount=SHARED_BOTS.length;
  next.bots=[...SHARED_BOTS];
  next.recordCount=next.records.length;
  next.indexes={byFingerprint:{},byBot:{},byKind:{}};
  for(const record of next.records){
    const add=(map,key)=>{
      if(!key)return;
      const list=Array.isArray(map[key])?map[key]:[];
      if(!list.includes(record.id)) list.push(record.id);
      map[key]=list.slice(-500);
    };
    add(next.indexes.byFingerprint,record.fingerprint);
    add(next.indexes.byBot,record.sourceBot);
    add(next.indexes.byKind,record.kind);
  }
  return next;
}

export function loadSharedMemory(){
  ensureParent();
  return withIndexes(readJson(SHARED_MEMORY_PATH,empty()));
}

function atomicWrite(memory){
  ensureParent();
  const tmp=SHARED_MEMORY_PATH+'.tmp-'+process.pid+'-'+Date.now();
  fs.writeFileSync(tmp,JSON.stringify(memory,null,2)+'\n',{encoding:'utf8',flag:'wx'});
  fs.renameSync(tmp,SHARED_MEMORY_PATH);
}

export function writeSharedMemory(input={}){
  const record=normalizeRecord(input);
  const current=loadSharedMemory();
  const duplicate=current.records.find(existing=>existing.id===record.id);
  if(duplicate) return {persisted:true,duplicate:true,record:duplicate,memory:current};
  const next={...current,records:[...current.records.slice(-4999),record],updatedAt:now()};
  atomicWrite(withIndexes(next));
  return {persisted:true,duplicate:false,record,memory:withIndexes(next)};
}

export function writeSharedBatch(records=[]){
  let memory=loadSharedMemory();
  let persisted=0,duplicates=0;
  const normalized=[];
  for(const input of Array.isArray(records)?records:[]){
    const record=normalizeRecord(input);
    const duplicate=memory.records.some(existing=>existing.id===record.id);
    if(duplicate){duplicates+=1;continue;}
    memory={...memory,records:[...memory.records.slice(-4999),record],updatedAt:now()};
    normalized.push(record);persisted+=1;
  }
  if(normalized.length) atomicWrite(withIndexes(memory));
  return {persisted,duplicates,records:normalized,memory:withIndexes(memory)};
}

export const publishSharedMemory=writeSharedMemory;
export const publishSharedBatch=writeSharedBatch;

export function readSharedMemory({fingerprint=null,botId=null,kinds=null,limit=80}={}){
  const memory=loadSharedMemory();
  const allowedKinds=Array.isArray(kinds)?new Set(kinds.filter(kind=>SHARED_KINDS.includes(kind))):null;
  if(botId) resolveSharedMemoryBotId(botId);
  const rows=memory.records.filter(record=>
    (!fingerprint||record.fingerprint===fingerprint) &&
    (!allowedKinds||allowedKinds.has(record.kind))
  ).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  return rows.slice(0,Math.max(1,Number(limit)||80));
}

function legacyReadThroughContext(limit=48){
  const memory=readJson(LEGACY_MEMORY_PATH,{cases:[],lessons:[],antiLessons:[],playbooks:[],actionHistory:[]});
  const cell=readJson(LEGACY_CELL_INDEX_PATH,{records:[]});
  const legacyLessons=[...(memory.lessons??[]).slice(-limit),...(cell.records??[]).filter(x=>x?.outcome==='success').slice(-limit)].map((item,index)=>({
    id:'LEGACY-L'+index,
    kind:'LESSON',
    status:'LEGACY_CONTEXT',
    rootCause:item.rootCause??null,
    rule:item.rule??null,
    claim:item.claim??item.knowledgeClaim??null,
    content:item.claim??item.knowledgeClaim??item.outcome??null,
    fingerprint:item.fingerprint??null,
    targetSha:item.targetSha??null,
  })).filter(item=>item.claim||item.content);
  const legacyAnti=[...(memory.antiLessons??[]).slice(-limit)].map((item,index)=>({
    id:'LEGACY-A'+index,
    kind:'ANTI_LESSON',
    status:'LEGACY_CONTEXT',
    rootCause:item.rootCause??null,
    rule:item.rule??null,
    claim:item.reason??item.text??item.rule??null,
    content:item.reason??item.text??item.rule??null,
    fingerprint:item.fingerprint??null,
    targetSha:item.targetSha??null,
  })).filter(item=>item.claim||item.content);
  const legacyErrors=[...(memory.cases??[]).slice(-limit),...(memory.actionHistory??[]).slice(-limit)].map((item,index)=>({
    id:'LEGACY-E'+index,
    kind:'ERROR',
    status:'LEGACY_CONTEXT',
    rootCause:item.rootCause??null,
    rule:item.rule??null,
    claim:item.normalizedFailure??item.rootCause??null,
    content:item.normalizedFailure??item.rootCause??null,
    fingerprint:item.fingerprint??null,
    targetSha:item.targetSha??null,
  })).filter(item=>item.claim||item.content);
  return {lessons:legacyLessons,antiLessons:legacyAnti,errors:legacyErrors,sourceCount:2,authority:'CONTEXT_ONLY'};
}

export function buildSharedLearningContext({fingerprint=null,botId=null,limit=48}={}){
  const records=readSharedMemory({fingerprint,botId,limit});
  const grouped=Object.fromEntries(SHARED_KINDS.map(kind=>[kind,records.filter(r=>r.kind===kind)]));
  const legacy=legacyReadThroughContext(limit);
  // Synchronous consumers use canonical in-repo memory. Remote external candidates are merged by buildAsyncSharedLearningContext or the API bridge.
  return {
    protocol:SHARED_MEMORY_PROTOCOL,
    authority:'CONTEXT_ONLY',
    mutationAuthority:false,
    certificationAuthority:false,
    canonical:true,
    targetAudience:[...SHARED_BOTS],
    memoryModel:SHARED_MEMORY_MODEL,
    cognitiveKernel:FLIXO_UNIFIED_COGNITIVE_KERNEL,
    overProvisionedCognition:OVER_PROVISIONED_COGNITION,
    cellMemberCount:CELL_MEMBER_COUNT,
    scope:SYSTEM_WIDE_MEMORY_SCOPE,
    recordCount:records.length,
    errors:[...grouped.ERROR,...legacy.errors].slice(0,limit),
    operations:grouped.OPERATION,
    advice:grouped.ADVICE,
    obligations:grouped.OBLIGATION,
    lessons:[...grouped.LESSON,...legacy.lessons].slice(0,limit),
    antiLessons:[...grouped.ANTI_LESSON,...legacy.antiLessons].slice(0,limit),
    legacyContext:legacy,
    counterexamples:grouped.COUNTEREXAMPLE,
    verifications:grouped.VERIFICATION,
    externalCandidates:[],
    remoteLearningPending:false,
    note:'Shared memory informs every internal FLIXO agent and repair bot through the same canonical store; it never proves GREEN or grants authority.'
  };
}

export async function buildAsyncSharedLearningContext({fingerprint=null,botId=null,limit=48,currentSha=null}={}){
  const context=buildSharedLearningContext({fingerprint,botId,limit});
  const targetSha=validSha(currentSha)?String(currentSha):null;
  const externalCandidates=targetSha?await readRemoteExternalLearning(targetSha,limit):[];
  const proposedLessons=externalCandidates.filter(item=>item.kind==='LESSON');
  const proposedAntiLessons=externalCandidates.filter(item=>item.kind==='ANTI_LESSON');
  const proposedAdvice=externalCandidates.filter(item=>item.kind==='ADVICE');
  const proposedCounterexamples=externalCandidates.filter(item=>item.kind==='COUNTEREXAMPLE');
  return {
    ...context,
    advice:[...proposedAdvice,...context.advice].slice(0,limit),
    lessons:[...proposedLessons,...context.lessons].slice(0,limit),
    antiLessons:[...proposedAntiLessons,...context.antiLessons].slice(0,limit),
    counterexamples:[...proposedCounterexamples,...context.counterexamples].slice(0,limit),
    externalCandidates,
    remoteLearningPending:false,
  };
}

export function buildSharedMemoryBootstrapSummary(){
  const sources=[
    'diagnostics/auto-repair/memory.json',
    'diagnostics/auto-repair/cell-knowledge/index.json',
    'diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json',
    'docs/agents/ACTION-ERROR-HISTORY.md',
  ];
  return Object.freeze({protocol:SHARED_MEMORY_PROTOCOL,canonical:true,legacyReadThrough:sources,mode:'SYSTEM_WIDE_CONTEXT_ONLY',intelligenceRegistry:'docs/agents/FLIXO-BOT.json',intelligenceVersion:'FLIXO-BOT-BRAIN-v2',targetBotCount:SHARED_BOTS.length});
}

if(import.meta.url===new URL(process.argv[1]??'','file:').href){
  const command=process.argv[2]??'status';
  if(command==='status'){
    const memory=loadSharedMemory();
    console.log(JSON.stringify({
      protocol:SHARED_MEMORY_PROTOCOL,
      path:path.relative(ROOT,SHARED_MEMORY_PATH),
      botCount:SHARED_BOTS.length,
      recordCount:memory.recordCount,
      bots:SHARED_BOTS,
      legacyReadThrough:memory.legacyReadThrough
    },null,2));
  } else {
    throw new Error('Usage: shared-operational-memory.mjs status');
  }
}
