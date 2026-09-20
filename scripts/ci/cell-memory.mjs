#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
export const BOT_MEMORY_DIR=path.resolve(ROOT,process.env.FLIXO_CELL_BOT_MEMORY_DIR??'diagnostics/auto-repair/cell-bots');
const ID_RE=/^CELL-\d{3}$/u;
const now=()=>new Date().toISOString();
const idOf=(value)=>{const id=String(value??'').trim().toUpperCase();if(!ID_RE.test(id))throw new Error('CELL_BOT_ID_INVALID');return id;};
const fileOf=(id)=>path.join(BOT_MEMORY_DIR,idOf(id)+'.json');
const cap=(list,item,max)=>[...(Array.isArray(list)?list:[]),...(Array.isArray(item)?item:[item])].slice(-max);
const empty=(id)=>({schemaVersion:1,authority:'CELL_BOT_PERSONAL_MEMORY',botId:idOf(id),copyable:true,transferableKnowledgeOnly:true,permanentIndependentAuthority:false,identity:{shortName:null,fullName:null,version:0},state:{status:'LEARNING',taskCount:0,lastTaskId:null,lastUpdatedAt:null},learnedTasks:[],knowledge:[],successfulStrategies:[],failedStrategies:[],solutions:[],weaknesses:[],upgrades:[],sourceEvidence:[],importHistory:[],exportHistory:[]});

export function loadBotMemory(botId){
  const id=idOf(botId);fs.mkdirSync(BOT_MEMORY_DIR,{recursive:true});
  try{const data=JSON.parse(fs.readFileSync(fileOf(id),'utf8'));if(data.botId===id||data.botId==='DERIVED_FROM_FILENAME')return {...empty(id),...data,botId:id};}catch{}
  return empty(id);
}
export function saveBotMemory(memory){
  const id=idOf(memory?.botId);const out={...empty(id),...memory,botId:id};
  fs.mkdirSync(BOT_MEMORY_DIR,{recursive:true});fs.writeFileSync(fileOf(id),JSON.stringify(out,null,2)+'\n');return out;
}
export function learnIntoBotMemory({botId,taskId,taskShortName,taskName,knowledge,verification,evidenceRef,outcome,rootCause,rule,solution,weakness,upgrade}={}){
  const m=loadBotMemory(botId);const at=now();const task={taskId:taskId??null,shortName:taskShortName??knowledge?.taskIdentity?.shortName??null,name:taskName??null,outcome:outcome??null,rootCause:rootCause??null,rule:rule??null,solution:solution??null,verification:verification??null,evidenceRef:evidenceRef??null,learnedAt:at};
  return saveBotMemory({...m,identity:{shortName:task.shortName??m.identity.shortName,fullName:task.name??m.identity.fullName,version:Math.max(Number(m.identity.version??0),Number(knowledge?.taskIdentity?.version??1))},state:{status:upgrade?.state??(outcome==='success'?'READY':'UPGRADING'),taskCount:Number(m.state.taskCount??0)+1,lastTaskId:task.taskId,lastUpdatedAt:at},learnedTasks:cap(m.learnedTasks,task,500),knowledge:cap(m.knowledge,knowledge??{},1000),successfulStrategies:outcome==='success'&&rule?cap(m.successfulStrategies,rule,1000):m.successfulStrategies,failedStrategies:outcome!=='success'&&rule?cap(m.failedStrategies,rule,1000):m.failedStrategies,solutions:solution?cap(m.solutions,{taskId:task.taskId,solution,rule:rule??null,outcome:task.outcome,verification:task.verification,at},1000):m.solutions,weaknesses:weakness?cap(m.weaknesses,{weakness,priority:Number(upgrade?.upgradePriority??1),taskId:task.taskId,at},100):m.weaknesses,upgrades:cap(m.upgrades,{...(upgrade??{}),taskId:task.taskId,at},200),sourceEvidence:evidenceRef?cap(m.sourceEvidence,{taskId:task.taskId,ref:evidenceRef,verification:task.verification,at},1000):m.sourceEvidence});
}
export function exportBotMemory(botId){
  const m=loadBotMemory(botId);return {...m,exportBundle:{schema:'FLIXO-CELL-BOT-MEMORY-v1',exportedAt:now(),knowledgeOnly:true,noPermissions:true,noIndependentAuthority:true}};
}
export function importBotKnowledge(botId,bundle){
  if(bundle?.transferableKnowledgeOnly===false||bundle?.permanentIndependentAuthority!==false||bundle?.exportBundle?.noPermissions===false)throw new Error('CELL_MEMORY_IMPORT_BOUNDARY_VIOLATION');
  const m=loadBotMemory(botId);return saveBotMemory({...m,learnedTasks:cap(m.learnedTasks,bundle.learnedTasks??[],500),knowledge:cap(m.knowledge,bundle.knowledge??[],1000),successfulStrategies:cap(m.successfulStrategies,bundle.successfulStrategies??[],1000),failedStrategies:cap(m.failedStrategies,bundle.failedStrategies??[],1000),solutions:cap(m.solutions,bundle.solutions??[],1000),weaknesses:cap(m.weaknesses,bundle.weaknesses??[],100),upgrades:cap(m.upgrades,bundle.upgrades??[],200),sourceEvidence:cap(m.sourceEvidence,bundle.sourceEvidence??[],1000),importHistory:cap(m.importHistory,{sourceBotId:bundle.botId??null,sourceSchema:bundle.exportBundle?.schema??null,at:now()},200)});
}
