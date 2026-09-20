#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const REGISTRY_PATH=path.resolve(ROOT,'docs/agents/CELL-BOT-REGISTRY.json');

export function loadCellControllerState(){
  const registry=JSON.parse(fs.readFileSync(REGISTRY_PATH,'utf8'));
  if(!Array.isArray(registry.bots)||registry.bots.length!==50) throw new Error('CELL_CONTROLLER_REQUIRES_50_BOTS');
  if(registry.bots.some(bot=>!/^CELL-\d{3}$/u.test(bot.id))) throw new Error('CELL_CONTROLLER_INVALID_BOT_NAMESPACE');
  if(Object.prototype.hasOwnProperty.call(registry,'actionRepairCohort')) throw new Error('CELL_CONTROLLER_ACTION_SQUAD_MUST_BE_EXTERNAL');
  return {registry,controller:registry.supervisor?.role??'assistantController'};
}

export function selectBotForTask({taskId,title='',objective='',shortName=''}={}){
  const {registry,controller}=loadCellControllerState();
  const bot=registry.bots.find(x=>x.currentAssignment==null);
  if(!bot) throw new Error('CELL_CONTROLLER_NO_ELIGIBLE_BOT');
  return {
    status:'ASSIGNED',
    botId:bot.id,
    executionMode:'GENERAL_EXECUTOR',
    taskId:String(taskId??''),
    controller,
    role:bot.taskIdentity?.fullName??'UNLEARNED_TASK',
    scopePolicy:bot.scopePolicy,
    taskPolicy:bot.taskPolicy,
    sameIncidentContext:false,
    requestedContext:{title:String(title??''),objective:String(objective??''),shortName:String(shortName??'')}
  };
}

if(import.meta.url===`file://${process.argv[1]}`){
  const task=JSON.parse(process.argv[2]??'{}');
  console.log(JSON.stringify(selectBotForTask(task),null,2));
}
