#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const memoryDir=()=>path.resolve(ROOT, process.env.FLIXO_ACTION_MEMORY_DIR ?? 'diagnostics/auto-repair/action-repair-bots');
const ID_RE=/^ACTION-(INDEX|WISE|WAKE|TWIN-1|TWIN-2)$/u;
const fileOf=id=>path.join(memoryDir(),String(id)+'.json');
const valid=id=>{if(!ID_RE.test(String(id))) throw new Error('ACTION_BOT_ID_INVALID'); return String(id)};
const now=()=>new Date().toISOString();
const bounded=(list,max=2000)=>Array.isArray(list)?list.slice(-max):[];

export function loadActionBotMemory(botId){
 const id=valid(botId); fs.mkdirSync(memoryDir(),{recursive:true});
 try { const x=JSON.parse(fs.readFileSync(fileOf(id),'utf8')); if(x.botId===id) return x; } catch {}
 return {
  schemaVersion:2, authority:'ACTION_REPAIR_BOT_PERSONAL_MEMORY', botId:id,
  copyable:true, transferableKnowledgeOnly:true, permanentIndependentAuthority:false,
  state:{status:'READY',taskCount:0,lastTaskId:null,lastUpdatedAt:null},
  learnedTasks:[],knowledge:[],solutions:[],successfulStrategies:[],failedStrategies:[],
  weaknesses:[],upgrades:[],sourceEvidence:[],redSignals:[],learningRequests:[],
  importHistory:[],exportHistory:[]
 };
}
export function saveActionBotMemory(memory){
 const id=valid(memory?.botId); fs.mkdirSync(memoryDir(),{recursive:true});
 const out={...loadActionBotMemory(id),...memory,botId:id};
 fs.writeFileSync(fileOf(id),JSON.stringify(out,null,2)+'\n'); return out;
}
export function learnIntoActionBotMemory({botId,taskId,knowledge,solution,outcome,rootCause,rule,verification,evidenceRef,fingerprint,runId,targetSha,failedSha,normalizedFailure}={}){
 const m=loadActionBotMemory(botId), at=now();
 const task={taskId:taskId??null,outcome:outcome??null,rootCause:rootCause??null,rule:rule??null,solution:solution??null,verification:verification??null,evidenceRef:evidenceRef??null,fingerprint:fingerprint??null,runId:runId??null,targetSha:targetSha??null,failedSha:failedSha??null,normalizedFailure:normalizedFailure?String(normalizedFailure).slice(0,12000):null,learnedAt:at};
 return saveActionBotMemory({
  ...m,
  state:{...(m.state??{}),taskCount:Number(m.state?.taskCount??0)+1,lastTaskId:task.taskId,lastUpdatedAt:at},
  learnedTasks:[...(m.learnedTasks??[]),task].slice(-1000),
  knowledge:knowledge?[...(m.knowledge??[]),knowledge].slice(-1000):m.knowledge,
  solutions:solution?[...(m.solutions??[]),{taskId:task.taskId,solution,rule:rule??null,outcome:task.outcome,verification:task.verification,at}].slice(-1000):m.solutions,
  successfulStrategies:outcome==='success'&&rule?[...(m.successfulStrategies??[]),rule].slice(-1000):m.successfulStrategies,
  failedStrategies:outcome!=='success'&&rule?[...(m.failedStrategies??[]),rule].slice(-1000):m.failedStrategies,
  sourceEvidence:evidenceRef?[...(m.sourceEvidence??[]),{taskId:task.taskId,ref:evidenceRef,at}].slice(-1000):m.sourceEvidence
 });
}

export function recordRedSignal({fingerprint,runId,targetSha,workflow,job,normalizedFailure,rawFailure,signalAt=now(),historicalMatchCount=0}={}){
 const fp=String(fingerprint??'').trim();
 if(!fp) throw new Error('ACTION_RED_FINGERPRINT_REQUIRED');
 if(!runId) throw new Error('ACTION_RED_RUN_ID_REQUIRED');
 if(!/^[a-f0-9]{40}$/iu.test(String(targetSha??''))) throw new Error('ACTION_RED_EXACT_SHA_REQUIRED');
 const m=loadActionBotMemory('ACTION-INDEX');
 const item={
  signalId:'RED-'+String(runId)+'-'+fp.slice(0,16),
  fingerprint:fp,runId:String(runId),targetSha:String(targetSha),
  workflow:workflow??null,job:job??null,status:'RED_OPEN',
  normalizedFailure:String(normalizedFailure??'').slice(0,16000),
  rawFailure:String(rawFailure??normalizedFailure??'').slice(0,24000),
  historicalMatchCount:Number(historicalMatchCount??0),
  solution:null,verification:null,evidenceRef:null,
  signalAt
 };
 const prior=(m.redSignals??[]).filter(x=>x.signalId!==item.signalId);
 return saveActionBotMemory({...m,redSignals:bounded([...prior,item],5000)});
}

export function createLearningRequest({fingerprint,runId,targetSha,workflow,job,normalizedFailure,reason='NO_VERIFIED_SOLUTION',master='repairAgent',requiredFields=[]}={}){
 const fp=String(fingerprint??'').trim();
 if(!fp||!runId||!/^[a-f0-9]{40}$/iu.test(String(targetSha??''))) throw new Error('ACTION_LEARNING_REQUEST_IDENTITY_INVALID');
 const m=loadActionBotMemory('ACTION-INDEX');
 const request={
  requestId:'LEARN-'+String(runId)+'-'+fp.slice(0,16),
  fingerprint:fp,runId:String(runId),targetSha:String(targetSha),
  workflow:workflow??null,job:job??null,normalizedFailure:String(normalizedFailure??'').slice(0,16000),
  status:'OPEN',reason,master,requiredFields:Array.isArray(requiredFields)?requiredFields:[],
  solution:null,verification:null,evidenceRef:null,openedAt:now(),closedAt:null
 };
 const prior=(m.learningRequests??[]).filter(x=>x.requestId!==request.requestId);
 return saveActionBotMemory({...m,learningRequests:bounded([...prior,request],5000)});
}

export function closeLearningRequest({fingerprint,runId,targetSha,solution,verification,evidenceRef,master='repairAgent'}={}){
 const fp=String(fingerprint??'').trim();
 if(!fp||!runId||!/^[a-f0-9]{40}$/iu.test(String(targetSha??''))) throw new Error('ACTION_LEARNING_CLOSE_IDENTITY_INVALID');
 if(!solution || typeof solution!=='object') throw new Error('ACTION_LEARNING_SOLUTION_REQUIRED');
 if(!verification) throw new Error('ACTION_LEARNING_VERIFICATION_REQUIRED');
 const m=loadActionBotMemory('ACTION-INDEX');
 let found=false;
 const requests=(m.learningRequests??[]).map(item=>{
  if(item.fingerprint===fp && String(item.runId)===String(runId) && item.status==='OPEN'){
   found=true;
   return {...item,status:'CLOSED_VALIDATED',solution,verification,evidenceRef:evidenceRef??null,master,closedAt:now()};
  }
  return item;
 });
 if(!found) throw new Error('ACTION_LEARNING_REQUEST_NOT_FOUND');
 const solutions=[...(m.solutions??[]),{requestId:'LEARN-'+String(runId)+'-'+fp.slice(0,16),solution,verification,master,validatedAt:now()}];
 return saveActionBotMemory({...m,learningRequests:bounded(requests,5000),solutions:bounded(solutions,2000)});
}

export function recordVerifiedGreen({fingerprint,runId,targetSha,solution,verification,evidenceRef}={}){
 if(!solution || typeof solution!=='object') throw new Error('ACTION_GREEN_SOLUTION_REQUIRED');
 if(!verification) throw new Error('ACTION_GREEN_VERIFICATION_REQUIRED');
 const m=loadActionBotMemory('ACTION-INDEX');
 const redSignals=(m.redSignals??[]).map(item=>{
  if(item.fingerprint===String(fingerprint??'') && String(item.runId)===String(runId) && item.status!=='GREEN_VERIFIED')
   return {...item,status:'GREEN_VERIFIED',solution,verification,evidenceRef:evidenceRef??null,greenVerifiedAt:now()};
  return item;
 });
 return saveActionBotMemory({...m,redSignals,solutions:[...(m.solutions??[]),{fingerprint,runId,targetSha,solution,verification,evidenceRef:evidenceRef??null,greenVerifiedAt:now()}].slice(-2000)});
}

export function copyHistoricalIndexToActionIndexBot(sourcePath='docs/agents/historical-action-errors/index.json'){
 const source=JSON.parse(fs.readFileSync(path.resolve(ROOT,sourcePath),'utf8'));
 const m=loadActionBotMemory('ACTION-INDEX');
 return saveActionBotMemory({...m,historicalActionIndexMirror:{schemaVersion:1,authority:'ACTION_INDEX_PERMANENT_COPY',knowledgeOnly:true,proofAuthority:'CURRENT_EXACT_SHA_CI_ONLY',sourcePath,sourceUpdatedAt:source.updatedAt??null,sourceRecordCount:Number(source.recordCount??0),snapshot:source}});
}
