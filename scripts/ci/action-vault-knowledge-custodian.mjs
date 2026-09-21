#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { ingest } from './agent-communication.mjs';

export const ACTION_VAULT_SUPERVISORY_LEARNING_PROTOCOL = 'ACTION-VAULT-SUPERVISORY-LEARNING-v1';
export const ACTION_VAULT_PROTOCOL_PATH = 'diagnostics/auto-repair/action-vault/ACTION-VAULT-SUPERVISORY-LEARNING-PROTOCOL.md';
export const ACTION_VAULT_MASTER_PROTOCOL_PATH = 'docs/AGENT-COLLABORATION-PROTOCOL.md';
export const ACTION_INDEX_PATH = 'diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json';
export const ACTION_INDEX_CAPACITY = 1_000_000;
const ROOT = process.cwd();
const now = () => new Date().toISOString();
const sha256 = (v) => crypto.createHash('sha256').update(String(v), 'utf8').digest('hex');
const git = (args) => execFileSync('git',['-C',ROOT,...args],{encoding:'utf8'}).trim();
const validSha = (v) => /^[0-9a-f]{40}$/u.test(String(v ?? ''));
const readText = (file) => fs.readFileSync(file,'utf8');
const indexFile = () => path.resolve(ROOT, process.env.ACTION_VAULT_INDEX_PATH ?? ACTION_INDEX_PATH);
const protocolFile = () => path.resolve(ROOT, ACTION_VAULT_PROTOCOL_PATH);
const writeAtomic = (file,value) => {
  const temp = file + '.tmp-' + process.pid;
  fs.writeFileSync(temp, JSON.stringify(value,null,2)+'\n');
  fs.renameSync(temp,file);
};
const masterFile = () => path.resolve(ROOT, ACTION_VAULT_MASTER_PROTOCOL_PATH);
const extractCanonicalProtocol = (content) => String(content).match(/<!-- ACTION_VAULT_CANONICAL_PROTOCOL_START -->[\\s\\S]*?<!-- ACTION_VAULT_CANONICAL_PROTOCOL_END -->/u)?.[0] ?? null;
const readCanonicalMaster = () => { const file=masterFile(); if(!fs.existsSync(file)) throw new Error('ACTION_VAULT_MASTER_PROTOCOL_MISSING'); const canonical=extractCanonicalProtocol(readText(file)); if(!canonical) throw new Error('ACTION_VAULT_MASTER_PROTOCOL_BLOCK_MISSING'); return canonical; };

const requiredMarkers = Object.freeze([
  'Protocol ID: ACTION-VAULT-SUPERVISORY-LEARNING-v1',
  'ACTION-INDEX-4000.json',
  'ACTION-HISTORIAN-3',
  'ACTION_VAULT_KNOWLEDGE_ESCALATION',
  'ACTION-VAULT-SUPERVISOR-TEACHING-001',
  'SPECIALIST_TEACHING',
  'apply-supervisor-lesson',
  'Canonical GREEN'
]);

export function assertVaultProtocolRead({ actor='ACTION-HISTORIAN-3', targetSha=git(['rev-parse','HEAD']) }={}) {
  if(!['ACTION-REPAIR','ACTION-REPAIR-2','ACTION-HISTORIAN-3'].includes(actor)) throw new Error('ACTION_VAULT_PROTOCOL_ACTOR_INVALID');
  if(!validSha(targetSha)) throw new Error('ACTION_VAULT_PROTOCOL_SHA_INVALID');
  if(git(['rev-parse','HEAD'])!==targetSha) throw new Error('ACTION_VAULT_PROTOCOL_SHA_STALE');
  const master=readCanonicalMaster();
  const mirrorFile=protocolFile();
  if(!fs.existsSync(mirrorFile)) throw new Error('ACTION_VAULT_SUPERVISORY_PROTOCOL_MISSING');
  const mirror=extractCanonicalProtocol(readText(mirrorFile));
  if(!mirror) throw new Error('ACTION_VAULT_SUPERVISORY_PROTOCOL_BLOCK_MISSING');
  if(mirror!==master) throw new Error('ACTION_VAULT_PROTOCOL_MIRROR_CONTENT_MISMATCH');
  const botFile=path.resolve(ROOT,'diagnostics/auto-repair/action-repair-bots',actor+'.json');
  if(!fs.existsSync(botFile)) throw new Error('ACTION_VAULT_BOT_PROFILE_MISSING='+actor);
  const bot=JSON.parse(readText(botFile));
  if(bot?.canonicalVaultProtocolMirror?.protocolId!=='ACTION-VAULT-CANONICAL-BOT-PROTOCOL-v1') throw new Error('ACTION_VAULT_BOT_PROTOCOL_MIRROR_MISSING='+actor);
  if(bot.canonicalVaultProtocolMirror.sourcePath!==ACTION_VAULT_MASTER_PROTOCOL_PATH||bot.canonicalVaultProtocolMirror.content!==master) throw new Error('ACTION_VAULT_BOT_PROTOCOL_MIRROR_MISMATCH='+actor);
  return {status:'READ',protocol:'ACTION-VAULT-CANONICAL-BOT-PROTOCOL-v1',actor,targetSha};
}

const assertWriteContext = ({ actor='ACTION-HISTORIAN-3', targetSha, taskId, fingerprint, runId }={}) => {
  if(actor!=='ACTION-HISTORIAN-3') throw new Error('ACTION_VAULT_INDEX_OWNER_ONLY');
  if(git(['branch','--show-current'])!=='execution') throw new Error('ACTION_VAULT_INDEX_BRANCH_BLOCKED');
  if(!validSha(targetSha)||git(['rev-parse','HEAD'])!==targetSha) throw new Error('ACTION_VAULT_INDEX_STALE_SHA');
  if(!taskId||!fingerprint||!runId) throw new Error('ACTION_VAULT_INDEX_IDENTITY_REQUIRED');
  assertVaultProtocolRead({actor,targetSha});
};

const loadIndex = () => {
  const file=indexFile();
  if(!fs.existsSync(file)) throw new Error('ACTION_VAULT_ACTION_INDEX_MISSING');
  const value=JSON.parse(readText(file));
  if(value.indexId!=='ACTION-INDEX-4000') throw new Error('ACTION_VAULT_ACTION_INDEX_ID_INVALID');
  if(!Array.isArray(value.records)) throw new Error('ACTION_VAULT_ACTION_INDEX_RECORDS_INVALID');
  if(value.records.length> ACTION_INDEX_CAPACITY) throw new Error('ACTION_VAULT_ACTION_INDEX_CAPACITY_EXCEEDED');
  return { file, value };
};
const nextNumber=(records) => records.reduce((max,item)=>{
  const n=Number(String(item?.id??'').match(/^T(\d+)$/u)?.[1]??0);
  return Math.max(max,n);
},5000)+1;
const baseRecord=({taskId,fingerprint,targetSha,runId,kind,botId='ACTION-HISTORIAN-3',diagnosis={},summary='',evidence=[]})=>({
  number: null,
  class: String(diagnosis?.errorClass??diagnosis?.errorType??diagnosis?.failureClass??kind).toLowerCase().replace(/\s+/gu,'-').slice(0,120) || kind.toLowerCase(),
  stage: String(diagnosis?.stage??'learn'),
  trigger: String(summary||'Action Vault learning event'),
  invariant: 'knowledge entries remain provenance-bound, bounded, and verifiable at the exact execution boundary.',
  action: String(summary||'Record the causal event and preserve the evidence.'),
  teaching: String(diagnosis?.teaching??summary||'Preserve exact provenance and continue learning without weakening the verification boundary.'),
  verify: String(diagnosis?.verify??'the entry remains bound to task, fingerprint, failed run and exact SHA'),
  actionVault: {
    source:'ACTION-HISTORIAN-3',
    botId, taskId, failureFingerprint:fingerprint, targetSha, failedRunId:String(runId),
    kind, recordedAt:now(), evidence:Array.isArray(evidence)?evidence.slice(0,32):[]
  },
  provenance:{taskId,failureFingerprint:fingerprint,targetSha,failedRunId:String(runId),sourceBot:botId}
});
const appendIndexRecord = ({taskId,fingerprint,targetSha,runId,kind,diagnosis={},summary,evidence,knowledgeStatus='PROVISIONAL'}={}) => {
  const {file,value}=loadIndex();
  const n=nextNumber(value.records);
  if(n> ACTION_INDEX_CAPACITY) throw new Error('ACTION_VAULT_ACTION_INDEX_CAPACITY_EXCEEDED');
  const record=baseRecord({taskId,fingerprint,targetSha,runId,kind,diagnosis,summary,evidence});
  record.id='T'+n;
  record.number=n;
  record.knowledgeStatus=knowledgeStatus;
  const updated={...value,recordCount:value.records.length+1,records:[...value.records,record],updatedAt:now(),catalogCapacity:ACTION_INDEX_CAPACITY};
  writeAtomic(file,updated);
  return record;
};

export function recordRepairOutcome({taskId,fingerprint,targetSha,failedRunId,diagnosis={},repairSummary='',evidence=[]}={}) {
  assertWriteContext({actor:'ACTION-HISTORIAN-3',targetSha,taskId,fingerprint,runId:failedRunId});
  const record=appendIndexRecord({taskId,fingerprint,targetSha,runId:failedRunId,kind:'REPAIRED',diagnosis,summary:repairSummary,evidence,knowledgeStatus:'REPAIRED_PROVISIONAL_UNTIL_GREEN'});
  return {status:'INDEX_REPAIR_RECORDED',recordId:record.id,indexPath:ACTION_INDEX_PATH,targetSha};
}

const councilRelayBody = ({messageId,taskId,fingerprint,targetSha,runId,errorSummary,diagnosis,attemptedStrategy}) => [
  '<!-- FLIXO_AGENT_COUNCIL_WAKE -->',
  '### ACTION VAULT SUPERVISORY LEARNING ESCALATION',
  'ROLE: REVIEW',
  'WORK PACKAGE: ACTION-VAULT-SUPERVISOR-TEACHING-001',
  'ACTOR: ACTION-HISTORIAN-3',
  'TASK ID: '+taskId,
  'ENTRY SHA: '+targetSha,
  'RUN ID: '+runId,
  'FAILURE FINGERPRINT: '+fingerprint,
  'STATUS: UNRESOLVED_REPAIR',
  'REQUEST: SPECIALIST_TEACHING',
  'INTENT: ACTION_VAULT_KNOWLEDGE_ESCALATION',
  'KNOWLEDGE INDEX: '+ACTION_INDEX_PATH,
  'DIAGNOSIS: '+String(diagnosis||'unknown').slice(0,1800),
  'ERROR: '+String(errorSummary||'unspecified').slice(0,3000),
  'ATTEMPTED STRATEGY: '+String(attemptedStrategy||'unspecified').slice(0,1800),
  'MESSAGE ID: '+messageId,
  'CLOSURE: CANONICAL_GREEN_ONLY',
].join('\n');

export function recordUnresolvedRepair({taskId,fingerprint,targetSha,failedRunId,errorSummary='',diagnosis='',attemptedStrategy='',evidence=[]}={}) {
  assertWriteContext({actor:'ACTION-HISTORIAN-3',targetSha,taskId,fingerprint,runId:failedRunId});
  const record=appendIndexRecord({
    taskId,fingerprint,targetSha,runId:failedRunId,kind:'UNRESOLVED_FAILURE',
    diagnosis:{errorType:'unresolved-repair',teaching:'The current repair attempt could not establish a verified correction.',verify:'a specialist lesson is received and the next exact-SHA attempt is revalidated'},
    summary:errorSummary,evidence,knowledgeStatus:'UNRESOLVED_ESCALATED'
  });
  const messageId='action-vault-learning:'+taskId+':'+fingerprint+':'+failedRunId;
  const message={
    schemaVersion:1,messageId,idempotencyKey:messageId+':'+targetSha,
    actor:'ACTION-HISTORIAN-3',recipient:'assistantController',
    intent:'ACTION_VAULT_KNOWLEDGE_ESCALATION',taskId,
    scope:['ACTION_VAULT_SUPERVISORY_LEARNING'],
    entrySha:targetSha,risk:'HIGH',
    dependencies:['ACTION_VAULT','ACTION-INDEX-4000','CURRENT_EXACT_SHA'],
    expectedEvidence:['FAILURE_FINGERPRINT','EXACT_SHA','FAILED_RUN_ID','UNRESOLVED_REPAIR_RECORD'],
    stopConditions:['SPECIALIST_TEACHING','CANONICAL_GREEN','STALE_SHA'],
    proofObligations:['MESSAGE_IDEMPOTENCY','EXACT_SHA_REVALIDATION','LESSON_PROVENANCE'],
    createdAt:now(),source:'ACTION_VAULT',
    payload:{
      requestedAction:'SPECIALIST_TEACHING',workPackageId:'ACTION-VAULT-SUPERVISOR-TEACHING-001',
      role:'REVIEW',failureFingerprint:fingerprint,failedRunId:String(failedRunId),
      diagnosis:String(diagnosis||'unknown').slice(0,4000),errorSummary:String(errorSummary).slice(0,5000),
      attemptedStrategy:String(attemptedStrategy).slice(0,3000),knowledgeIndex:ACTION_INDEX_PATH,
      unresolvedRecordId:record.id,evidence
    }
  };
  const receipt=ingest(message,targetSha);
  let councilDelivery='QUEUED_IN_CANONICAL_AGENT_INBOX';
  let councilDeliveryError=null;
  const token=process.env.GH_TOKEN||process.env.GITHUB_TOKEN;
  const repository=process.env.GITHUB_REPOSITORY;
  if(token&&repository){
    try{
      const body=councilRelayBody({messageId,taskId,fingerprint,targetSha,runId:failedRunId,errorSummary,diagnosis,attemptedStrategy});
      execFileSync('gh',['api','--method','POST',`repos/${repository}/issues/759/comments`,'--raw-field',`body=${body}`],{cwd:ROOT,encoding:'utf8',env:{...process.env,GH_TOKEN:token}});
      councilDelivery='DELIVERED_TO_COUNCIL_INGRESS';
    }catch(error){ councilDeliveryError=String(error?.message??error); }
  }
  return {status:'UNRESOLVED_ESCALATED',recordId:record.id,messageId,receipt,councilDelivery,councilDeliveryError,relayMarker:'<!-- FLIXO_AGENT_COUNCIL_WAKE -->',workPackageId:'ACTION-VAULT-SUPERVISOR-TEACHING-001'};
}

const parseArgs=()=>{
  const args={};
  for(const token of process.argv.slice(2)){if(!token.startsWith('--')) continue; const i=token.indexOf('='); const k=token.slice(2,i<0?undefined:i); args[k]=i<0?'':token.slice(i+1);}
  return args;
};
const jsonArg=(value,label)=>{try{return JSON.parse(value)}catch{throw new Error('ACTION_VAULT_JSON_INVALID='+label)}};
const fileJson=(file,label)=>JSON.parse(fs.readFileSync(path.resolve(ROOT,file),'utf8'));
if(import.meta.url===`file://${process.argv[1]}`){
  try{
    const op=String(process.argv[2]??'').trim();
    const a=parseArgs();
    if(op==='assert-read'){
      console.log(JSON.stringify(assertVaultProtocolRead({actor:a.bot,targetSha:a.sha||git(['rev-parse','HEAD'])}),null,2));
    }else if(op==='record-repair'){
      const diagnosis=a['diagnosis-file']?fileJson(a['diagnosis-file'],'diagnosis'):jsonArg(a.diagnosis||'{}','diagnosis');
      console.log(JSON.stringify(recordRepairOutcome({taskId:a.task,fingerprint:a.fingerprint,targetSha:a.sha,failedRunId:a['run-id'],diagnosis,repairSummary:a['repair-summary'],evidence:String(a.evidence||'').split(',').map(x=>x.trim()).filter(Boolean)}),null,2));
    }else if(op==='record-blocked'){
      console.log(JSON.stringify(recordUnresolvedRepair({taskId:a.task,fingerprint:a.fingerprint,targetSha:a.sha,failedRunId:a['run-id'],errorSummary:a.error,diagnosis:a.diagnosis,attemptedStrategy:a.strategy,evidence:String(a.evidence||'').split(',').map(x=>x.trim()).filter(Boolean)}),null,2));
    }else if(op==='edit-index'){
      assertWriteContext({actor:'ACTION-HISTORIAN-3',targetSha:a.sha,taskId:a.task||'index-edit',fingerprint:a.fingerprint||'index-edit',runId:a['run-id']||'index-edit'});
      const {file,value}=loadIndex(); const id=String(a['record-id']||''); if(!id) throw new Error('ACTION_VAULT_RECORD_ID_REQUIRED');
      const idx=value.records.findIndex(x=>x.id===id); if(idx<0) throw new Error('ACTION_VAULT_RECORD_NOT_FOUND='+id);
      const patch=jsonArg(a['patch-json']||'{}','patch');
      delete patch.id; delete patch.number; delete patch.actionVault;
      value.records[idx]={...value.records[idx],...patch,provenance:{...(value.records[idx].provenance||{}),editedBy:'ACTION-HISTORIAN-3',editedAt:now(),targetSha:a.sha}};
      value.updatedAt=now(); value.catalogCapacity=ACTION_INDEX_CAPACITY;
      writeAtomic(file,value);
      console.log(JSON.stringify({status:'INDEX_RECORD_EDITED',recordId:id,indexPath:ACTION_INDEX_PATH,targetSha:a.sha},null,2));
    }else if(op==='apply-supervisor-lesson'){
      const lesson=fileJson(a['lesson-file'],'lesson');
      assertWriteContext({actor:'ACTION-HISTORIAN-3',targetSha:a.sha,taskId:a.task,fingerprint:a.fingerprint,runId:a['run-id']});
      if(lesson.protocol!=='ACTION-VAULT-SUPERVISOR-LESSON-v1'||lesson.status!=='SUPERVISOR_TEACHING_VERIFIED'||lesson.taskId!==a.task||lesson.failureFingerprint!==a.fingerprint||lesson.targetSha!==a.sha||!lesson.supervisorRole||!lesson.knowledgePrinciple||!lesson.repairPattern||!lesson.verificationCondition) throw new Error('ACTION_VAULT_SUPERVISOR_LESSON_INVALID');
      const diagnosis={errorType:lesson.rootCause??'supervisor-taught',stage:'learn',teaching:lesson.knowledgePrinciple,verify:lesson.verificationCondition};
      const record=appendIndexRecord({taskId:a.task,fingerprint:a.fingerprint,targetSha:a.sha,runId:a['run-id'],kind:'SUPERVISOR_TAUGHT',diagnosis,summary:lesson.repairPattern,evidence:[lesson.sourceMessageId||'SUPERVISOR_MESSAGE',...(lesson.evidenceRefs||[])],knowledgeStatus:'SUPERVISOR_TAUGHT_PENDING_GREEN'});
      console.log(JSON.stringify({status:'SUPERVISOR_LESSON_INDEXED',recordId:record.id,indexPath:ACTION_INDEX_PATH,targetSha:a.sha,supervisorRole:lesson.supervisorRole},null,2));
    }else{
      throw new Error('ACTION_VAULT_KNOWLEDGE_OPERATION_INVALID');
    }
  }catch(error){
    console.error('ACTION_VAULT_KNOWLEDGE_GATE_BLOCK='+String(error?.message??error));
    process.exit(1);
  }
}