#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { learnIntoBotMemory } from './cell-memory.mjs';
import { publishSharedMemory } from './shared-operational-memory.mjs';
import { execFileSync } from 'node:child_process';

const ROOT=process.cwd();
const KNOWLEDGE_DIR=path.resolve(ROOT,process.env.FLIXO_CELL_KNOWLEDGE_DIR??'diagnostics/auto-repair/cell-knowledge');
const INDEX_FILE=path.join(KNOWLEDGE_DIR,'index.json');
const MAX_RECORDS=5000;
const SHA=/^[a-f0-9]{40}$/iu;
const now=()=>new Date().toISOString();
const sha256=(value)=>createHash('sha256').update(String(value),'utf8').digest('hex');
const readJson=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}};
const validSha=(value)=>SHA.test(String(value??''));
const ensure=()=>fs.mkdirSync(KNOWLEDGE_DIR,{recursive:true});
function emptyIndex(){return {schemaVersion:1,authority:'CELL_KNOWLEDGE_INDEX',source:'FLIXO_TASK_OUTCOME',proofAuthority:'CURRENT_EXACT_SHA_CI_ONLY',observationValidation:'REQUIRED',recordCount:0,byFingerprint:{},byRootCause:{},byRule:{},records:[]};}
function load(){ensure();return readJson(INDEX_FILE,emptyIndex());}
function clamp(number,min=1,max=100){return Math.min(max,Math.max(min,Number(number)||min));}
function deriveTaskShortName(input={}){const explicit=String(input.taskShortName??'').trim().toUpperCase().replace(/[^A-Z0-9_-]/g,'');if(explicit)return explicit.slice(0,12);const tokens=String(input.taskName??input.rootCause??'TASK').trim().toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);return (tokens.length===1?tokens[0]:tokens.map((token)=>token[0]).join('')).slice(0,12)||'TASK';}
function deriveWeakness(input={},validation={}){const explicit=String(input.weakness??'').trim();if(explicit)return explicit;if(!validation.validated)return 'EVIDENCE_VALIDATION';if(input.outcome!=='success')return String(input.rootCause??'UNKNOWN')+'::REPAIR_GAP';return 'NEXT_GENERALIZATION';}
export function deriveBotUpgrade({outcome='observation',attempts=0,successes=0,upgradeNumber=0,upgradePriority=1,weakness=null,validation={validated:false}}={}){const attemptCount=Math.max(0,Number(attempts));const successCount=Math.max(0,Number(successes));const rate=attemptCount?successCount/attemptCount:0;const boost=outcome==='success'?0:outcome==='proposal-only'?15:25;const evidencePenalty=validation.validated?0:20;return Object.freeze({upgradeNumber:Math.max(0,Number(upgradeNumber)||0)+1,upgradePriority:clamp(Math.round(Math.max(1,Number(upgradePriority)||1)+boost+evidencePenalty-(rate*10))),weakness:weakness??'REASSESS_AFTER_TASK',state:outcome==='success'&&validation.validated?'READY':'UPGRADING',reason:validation.validated?'evidence-backed-reassessment':'evidence-gap-requires-upgrade'});}
function add(map,key,id,limit=200){if(!key)return;const list=Array.isArray(map[key])?map[key]:[];if(!list.includes(id))list.push(id);map[key]=list.slice(-limit);}
function readCanonicalRunEvidence(runId,targetSha){
  if(!String(runId??'').trim()||!validSha(targetSha))return {available:false,reason:'RUN_OR_SHA_MISSING'};
  const repository=String(process.env.GITHUB_REPOSITORY??'').trim();
  if(!repository||process.env.GITHUB_ACTIONS!=='true')return {available:false,reason:'CANONICAL_GITHUB_CONTEXT_REQUIRED'};
  try{
    const run=JSON.parse(execFileSync('gh',['run','view',String(runId),'--repo',repository,'--json','databaseId,headSha,conclusion,event,name,status'],{encoding:'utf8'}));
    const idMatch=String(run.databaseId??'')===String(runId);
    const headMatch=String(run.headSha??'')===String(targetSha);
    if(!idMatch||!headMatch)return {available:true,validated:false,canonicalGreen:false,reason:'CANONICAL_RUN_ID_OR_SHA_MISMATCH',run};
    const canonicalGreen=String(run.name??'')==='Daily·FLIXO Green Gate' && String(run.conclusion??'').toLowerCase()==='success';
    return {available:true,validated:true,canonicalGreen,run};
  }catch(error){
    return {available:true,validated:false,canonicalGreen:false,reason:'CANONICAL_RUN_LOOKUP_FAILED',error:String(error?.message??error)};
  }
}
export function validateObservation({outcome,verification,targetSha,failedSha,runId}={}){
 const normalizedOutcome=String(outcome??'').trim();
 const normalizedVerification=String(verification??'').trim();
 const exactTarget=validSha(targetSha);
 const exactFailed=failedSha==null||failedSha===''||validSha(failedSha);
 const runEvidence=readCanonicalRunEvidence(runId,targetSha);
 const evidenceComplete=Boolean(normalizedVerification)&&Boolean(runId)&&runEvidence.validated===true;
 const validated=Boolean(exactTarget&&exactFailed&&evidenceComplete);
 const canonicalGreen=validated && runEvidence.canonicalGreen===true;
 return Object.freeze({validated,canonicalGreen,exactTargetSha:exactTarget,failedShaValid:exactFailed,evidenceComplete,runEvidence,reason:validated?'validated':'insufficient-proof',observationKind:['success','failure','blocked','unrepaired','blocked-external','proposal-only'].includes(normalizedOutcome)?normalizedOutcome:'observation'});
}
export function buildKnowledgeRecord(input={}){
 const validation=validateObservation(input);
 const fingerprint=String(input.fingerprint??'').trim();
 const rootCause=String(input.rootCause??'unknown').trim()||'unknown';
 const rule=input.rule?String(input.rule).trim():null;
 const outcome=String(input.outcome??'observation').trim();
 const taskId=input.taskId?String(input.taskId).trim():null;
 const runId=input.runId?String(input.runId).trim():null;
 const targetSha=validSha(input.targetSha)?String(input.targetSha):null;
 const failedSha=validSha(input.failedSha)?String(input.failedSha):null;
 const claim=input.knowledgeClaim!=null?String(input.knowledgeClaim).trim():
   (outcome==='success'
     ? 'Strategy '+(rule??'unspecified')+' recovered the observed '+rootCause+' case under verification '+(input.verification??'unknown')+'.'
     : 'The observed '+rootCause+' case produced outcome '+outcome+' under strategy '+(rule??'none')+'; retain this result as repair history and do-not-repeat evidence where applicable.');
 const antiLesson=String(input.antiLesson??(outcome==='success'?'':rule?'Do not repeat strategy '+rule+' for this fingerprint without new evidence.':'')).trim()||null;
 const reusable=String(input.reusability??(outcome==='success'?'HIGH':'MEDIUM')).trim();
 const taskShortName=deriveTaskShortName(input); const weakness=deriveWeakness(input,validation); const botId=input.botId?String(input.botId).trim():null; const solution=input.solution??(rule?{strategyId:process.env.FLIXO_REPAIR_STRATEGY_ID??null,rule,rootCause,verification:input.verification,changedPaths:Array.isArray(input.changedPaths)?input.changedPaths.slice(0,32):[]}:null); const botUpgrade=deriveBotUpgrade({outcome,attempts:input.attempts,successes:input.successes,upgradeNumber:input.upgradeNumber,upgradePriority:input.upgradePriority,weakness,validation});
 const personalMemory=botId?learnIntoBotMemory({botId,taskId,taskShortName,taskName:input.taskName??null,knowledge:{id:'CK-'+sha256([taskId,fingerprint,runId].join('|')).slice(0,24),claim,solution,fingerprint,runId,targetSha,failedSha,normalizedFailure:String(input.normalizedFailure??'').slice(0,12000),taskIdentity:{version:Math.max(1,Number(input.taskVersion)||1)}},verification:input.verification,evidenceRef:input.evidenceRef??null,outcome,rootCause,rule,solution,weakness,upgrade:botUpgrade,fingerprint,runId,targetSha,failedSha,normalizedFailure:input.normalizedFailure??null}):null;
 return Object.freeze({id:'CK-'+sha256([taskId,fingerprint,runId,now()].join('|')).slice(0,24),schemaVersion:2,taskId,fingerprint:fingerprint||null,runId,targetSha,failedSha,rootCause,rule,outcome,claim,solution,taskIdentity:{shortName:taskShortName,state:validation.validated?'LEARNED':'UNPROVEN',version:Math.max(1,Number(input.taskVersion)||1)},botProfile:botId?{botId,taskShortName,upgrade:botUpgrade,lifecycle:{state:botUpgrade.state,reassessAfterTask:true,noRawTerminalState:true}}:null,evidence:{verification:String(input.verification??'unknown'),source:String(input.source??'FLIXO Auto Repair'),evidenceRef:input.evidenceRef??null,changedPaths:Array.isArray(input.changedPaths)?input.changedPaths.slice(0,32):[]},validation,confidence:validation.canonicalGreen&&outcome==='success'?'CONFIRMED':validation.validated?'OBSERVED':'UNPROVEN',reusability:reusable,personalMemory:personalMemory?{botId:personalMemory.botId,taskCount:personalMemory.state.taskCount,memoryFile:'diagnostics/auto-repair/cell-bots/'+personalMemory.botId+'.json'}:null,antiLesson,createdAt:now()});
}
export function persistKnowledge(record){
 if(!record||record.confidence==='UNPROVEN')return {persisted:false,reason:'knowledge-unproven'};
 const index=load();
 if(index.records.some((item)=>item.id===record.id))return {persisted:true,duplicate:true,id:record.id};
 index.records.push(record);index.records=index.records.slice(-MAX_RECORDS);index.recordCount=index.records.length;
 add(index.byFingerprint,record.fingerprint,record.id);add(index.byRootCause,record.rootCause,record.id);add(index.byRule,record.rule,record.id);
 index.updatedAt=now();fs.writeFileSync(INDEX_FILE,JSON.stringify(index,null,2)+'\n');
 const sharedSource=['ACTION-REPAIR','ACTION-REPAIR-2','READ-INVESTIGATOR','READ-ADVERSARY','executionAgent','reviewAgent'].includes(String(record?.botProfile?.botId))?String(record.botProfile.botId):'executionAgent';
 const shared=publishSharedMemory({sourceBot:sharedSource,kind:record.antiLesson?'ANTI_LESSON':record.outcome==='success'?'LESSON':['failure','blocked','unrepaired'].includes(record.outcome)?'ERROR':'OPERATION',taskId:record.taskId??record.id,fingerprint:record.fingerprint,runId:record.runId,targetSha:record.targetSha,failedSha:record.failedSha,rootCause:record.rootCause,rule:record.rule,claim:record.claim,content:record.antiLesson??record.claim,advice:record.antiLesson??record.rule??null,evidenceRefs:[record.evidence?.evidenceRef].filter(Boolean),changedPaths:record.evidence?.changedPaths??[],verification:record.evidence?.verification,status:record.confidence==='CONFIRMED'&&record.validation.canonicalGreen===true?'VERIFIED':'OBSERVED',canonicalGreen:record.validation.canonicalGreen===true});
 return {persisted:true,duplicate:false,id:record.id,sharedMemoryId:shared.record.id};
}
if(import.meta.url===new URL(process.argv[1]??'','file:').href){
 const record=buildKnowledgeRecord({outcome:process.env.FLIXO_LEARNING_OUTCOME??'observation',verification:process.env.FLIXO_VERIFICATION??'unknown',targetSha:process.env.FLIXO_TARGET_SHA,failedSha:process.env.FLIXO_FAILED_SHA,runId:process.env.FLIXO_RUN_ID,fingerprint:process.env.FLIXO_FAILURE_FINGERPRINT,rootCause:process.env.FLIXO_ROOT_CAUSE,rule:process.env.FLIXO_REPAIR_RULE||null,taskId:process.env.FLIXO_TASK_ID||null,changedPaths:(process.env.FLIXO_CHANGED_PATHS??'').split(',').map((x)=>x.trim()).filter(Boolean)});
 console.log(JSON.stringify({validation:record.validation,confidence:record.confidence,persist:persistKnowledge(record),id:record.id},null,2));
}
