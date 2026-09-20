#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

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
function add(map,key,id,limit=200){if(!key)return;const list=Array.isArray(map[key])?map[key]:[];if(!list.includes(id))list.push(id);map[key]=list.slice(-limit);}
export function validateObservation({outcome,verification,targetSha,failedSha,runId}={}){
 const normalizedOutcome=String(outcome??'').trim();
 const normalizedVerification=String(verification??'').trim();
 const exactTarget=validSha(targetSha);
 const exactFailed=failedSha==null||failedSha===''||validSha(failedSha);
 const evidenceComplete=Boolean(normalizedVerification)&&Boolean(runId||exactTarget);
 const validated=Boolean(exactTarget&&exactFailed&&evidenceComplete);
 return Object.freeze({validated,exactTargetSha:exactTarget,failedShaValid:exactFailed,evidenceComplete,reason:validated?'validated':'insufficient-proof',observationKind:['success','failure','blocked','unrepaired','blocked-external','proposal-only'].includes(normalizedOutcome)?normalizedOutcome:'observation'});
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
 return Object.freeze({id:'CK-'+sha256([taskId,fingerprint,runId,now()].join('|')).slice(0,24),schemaVersion:1,taskId,fingerprint:fingerprint||null,runId,targetSha,failedSha,rootCause,rule,outcome,claim,evidence:{verification:String(input.verification??'unknown'),source:String(input.source??'FLIXO Auto Repair'),evidenceRef:input.evidenceRef??null,changedPaths:Array.isArray(input.changedPaths)?input.changedPaths.slice(0,32):[]},validation,confidence:validation.validated?(outcome==='success'?'CONFIRMED':'OBSERVED'):'UNPROVEN',reusability:reusable,antiLesson,createdAt:now()});
}
export function persistKnowledge(record){
 if(!record||record.confidence==='UNPROVEN')return {persisted:false,reason:'knowledge-unproven'};
 const index=load();
 if(index.records.some((item)=>item.id===record.id))return {persisted:true,duplicate:true,id:record.id};
 index.records.push(record);index.records=index.records.slice(-MAX_RECORDS);index.recordCount=index.records.length;
 add(index.byFingerprint,record.fingerprint,record.id);add(index.byRootCause,record.rootCause,record.id);add(index.byRule,record.rule,record.id);
 index.updatedAt=now();fs.writeFileSync(INDEX_FILE,JSON.stringify(index,null,2)+'\n');
 return {persisted:true,duplicate:false,id:record.id};
}
if(import.meta.url===new URL(process.argv[1]??'','file:').href){
 const record=buildKnowledgeRecord({outcome:process.env.FLIXO_LEARNING_OUTCOME??'observation',verification:process.env.FLIXO_VERIFICATION??'unknown',targetSha:process.env.FLIXO_TARGET_SHA,failedSha:process.env.FLIXO_FAILED_SHA,runId:process.env.FLIXO_RUN_ID,fingerprint:process.env.FLIXO_FAILURE_FINGERPRINT,rootCause:process.env.FLIXO_ROOT_CAUSE,rule:process.env.FLIXO_REPAIR_RULE||null,taskId:process.env.FLIXO_TASK_ID||null,changedPaths:(process.env.FLIXO_CHANGED_PATHS??'').split(',').map((x)=>x.trim()).filter(Boolean)});
 console.log(JSON.stringify({validation:record.validation,confidence:record.confidence,persist:persistKnowledge(record),id:record.id},null,2));
}
