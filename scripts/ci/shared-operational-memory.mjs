#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const ROOT=process.cwd();
export const SHARED_MEMORY_PATH=path.resolve(ROOT,process.env.FLIXO_SHARED_OPERATIONAL_MEMORY??'diagnostics/auto-repair/SHARED-OPERATIONAL-MEMORY.json');
export const SHARED_MEMORY_PROTOCOL='FLIXO-SHARED-OPERATIONAL-MEMORY-v1';
export const SHARED_BOTS=Object.freeze([
  'ACTION-REPAIR',
  'ACTION-REPAIR-2',
  'READ-INVESTIGATOR',
  'READ-ADVERSARY',
  'executionAgent',
  'reviewAgent',
]);
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

const empty=()=>({
  schemaVersion:1,
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
  if(!SHARED_BOTS.includes(sourceBot)) failures.push('SOURCE_BOT_INVALID');
  if(!SHARED_KINDS.includes(String(input.kind??''))) failures.push('KIND_INVALID');
  if(!validSha(input.targetSha)) failures.push('EXACT_TARGET_SHA_REQUIRED');
  if(!String(input.taskId??'').trim()) failures.push('TASK_ID_REQUIRED');
  if(!String(input.claim??input.content??'').trim()) failures.push('LEARNING_CONTENT_REQUIRED');
  if(input.mutationAuthority===true) failures.push('SHARED_MEMORY_CANNOT_GRANT_MUTATION');
  if(input.certificationAuthority===true) failures.push('SHARED_MEMORY_CANNOT_GRANT_CERTIFICATION');
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
    sourceBot:String(input.sourceBot),
    audience:[...SHARED_BOTS],
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
    antiLesson:Boolean(input.antiLesson===true||String(input.kind)==='ANTI_LESSON'),
    source:'SHARED_MEMORY_WRITE',
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

export function publishSharedMemory(input={}){
  const record=normalizeRecord(input);
  const current=loadSharedMemory();
  const duplicate=current.records.find(existing=>existing.id===record.id);
  if(duplicate) return {persisted:true,duplicate:true,record:duplicate,memory:current};
  const next={...current,records:[...current.records.slice(-4999),record],updatedAt:now()};
  atomicWrite(withIndexes(next));
  return {persisted:true,duplicate:false,record,memory:withIndexes(next)};
}

export function publishSharedBatch(records=[]){
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

export function readSharedMemory({fingerprint=null,botId=null,kinds=null,limit=80}={}){
  const memory=loadSharedMemory();
  const allowedKinds=Array.isArray(kinds)?new Set(kinds.filter(kind=>SHARED_KINDS.includes(kind))):null;
  const rows=memory.records.filter(record=>
    (!fingerprint||record.fingerprint===fingerprint) &&
    (!botId||record.audience.includes(botId)) &&
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
  return {
    protocol:SHARED_MEMORY_PROTOCOL,
    authority:'CONTEXT_ONLY',
    mutationAuthority:false,
    certificationAuthority:false,
    canonical:true,
    targetAudience:[...SHARED_BOTS],
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
    note:'Shared memory informs all six bots; it never proves GREEN or grants authority.'
  };
}

export function buildSharedMemoryBootstrapSummary(){
  const sources=[
    'diagnostics/auto-repair/memory.json',
    'diagnostics/auto-repair/cell-knowledge/index.json',
    'diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json',
    'docs/agents/ACTION-ERROR-HISTORY.md',
  ];
  return Object.freeze({protocol:SHARED_MEMORY_PROTOCOL,canonical:true,legacyReadThrough:sources,mode:'CONTEXT_ONLY',targetBotCount:SHARED_BOTS.length});
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
