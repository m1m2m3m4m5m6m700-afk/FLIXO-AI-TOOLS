#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const memoryDir=()=>path.resolve(ROOT, process.env.FLIXO_ACTION_MEMORY_DIR ?? 'diagnostics/auto-repair/action-repair-bots');
const ID_RE=/^ACTION-(INDEX|WISE|WAKE|TWIN-1|TWIN-2)$/u;
const fileOf=id=>path.join(memoryDir(),String(id)+'.json');
const valid=id=>{if(!ID_RE.test(String(id))) throw new Error('ACTION_BOT_ID_INVALID'); return String(id)};
const now=()=>new Date().toISOString();

export function loadActionBotMemory(botId){
 const id=valid(botId); fs.mkdirSync(memoryDir(),{recursive:true});
 try { const x=JSON.parse(fs.readFileSync(fileOf(id),'utf8')); if(x.botId===id) return x; } catch {}
 return {schemaVersion:1,authority:'ACTION_REPAIR_BOT_PERSONAL_MEMORY',botId:id,copyable:true,transferableKnowledgeOnly:true,permanentIndependentAuthority:false,state:{status:'READY',taskCount:0,lastTaskId:null,lastUpdatedAt:null},learnedTasks:[],knowledge:[],solutions:[],successfulStrategies:[],failedStrategies:[],sourceEvidence:[]};
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
export function copyHistoricalIndexToActionIndexBot(sourcePath='docs/agents/historical-action-errors/index.json'){
 const source=JSON.parse(fs.readFileSync(path.resolve(ROOT,sourcePath),'utf8'));
 const m=loadActionBotMemory('ACTION-INDEX');
 return saveActionBotMemory({...m,historicalActionIndexMirror:{schemaVersion:1,authority:'ACTION_INDEX_PERMANENT_COPY',knowledgeOnly:true,sourcePath,sourceUpdatedAt:source.updatedAt??null,sourceRecordCount:Number(source.recordCount??0),snapshot:source}});
}
