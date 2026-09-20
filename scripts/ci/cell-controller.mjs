#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const REGISTRY_PATH=path.resolve(ROOT,'docs/agents/CELL-BOT-REGISTRY.json');

export function loadCellControllerState(){
  const registry=JSON.parse(fs.readFileSync(REGISTRY_PATH,'utf8'));
  if(!Array.isArray(registry.bots)||registry.bots.length!==50) throw new Error('CELL_CONTROLLER_REQUIRES_50_BOTS');
  return {registry,controller:registry.supervisor?.role??'assistantController',council:registry.actionRepairCohort?.workerIds??[]};
}
function normalized(v){return String(v??'').trim().toLowerCase();}
const actionMatchers=[
  [/actions|action error|github actions|workflow error|run failure/iu,'CELL-001','LEARNED_SPECIALIZATION'],
  [/wake|wakeup|wake up|prepare.*system/iu,'CELL-002','LEARNED_SPECIALIZATION'],
  [/twin.?a|adversarial a|alternative a/iu,'CELL-003','LEARNED_SPECIALIZATION'],
  [/twin.?b|adversarial b|alternative b/iu,'CELL-004','LEARNED_SPECIALIZATION'],
  [/select.*best|choose.*best|best option|decision/iu,'CELL-005','LEARNED_SPECIALIZATION'],
];
export function selectBotForTask({taskId,title='',objective='',shortName=''}={}){
  const {registry,controller}=loadCellControllerState();
  const text=normalized([title,objective,shortName].join(' '));
  const match=actionMatchers.find(([re])=>re.test(text));
  const preferred=match?.[1]??null;
  const mode=match?.[2]??'GENERAL_EXECUTOR';
  const bot=preferred?registry.bots.find(x=>x.id===preferred):registry.bots.find(x=>!['CELL-001','CELL-002','CELL-003','CELL-004','CELL-005'].includes(x.id) && x.currentAssignment==null);
  if(!bot) throw new Error('CELL_CONTROLLER_NO_ELIGIBLE_BOT');
  return {
    status:'ASSIGNED',
    botId:bot.id,
    executionMode:mode,
    taskId:String(taskId??''),
    controller,
    role:bot.taskIdentity?.fullName??'UNLEARNED_TASK',
    scopePolicy:bot.scopePolicy,
    taskPolicy:bot.taskPolicy,
    sameIncidentContext:Boolean(preferred),
  };
}
if(import.meta.url===`file://${process.argv[1]}`){
  const task=JSON.parse(process.argv[2]??'{}');
  console.log(JSON.stringify(selectBotForTask(task),null,2));
}
