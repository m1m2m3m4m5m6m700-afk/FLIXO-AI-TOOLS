#!/usr/bin/env node
import assert from 'node:assert/strict';
import {loadCellControllerState,selectBotForTask} from './cell-controller.mjs';

const {registry}=loadCellControllerState();
assert.equal(registry.bots.length,50);
assert.equal(registry.bots.every(bot=>bot.id.startsWith('CELL-')),true);
assert.equal(registry.bots.some(bot=>bot.id.startsWith('ACTION-')),false);
assert.equal(Object.prototype.hasOwnProperty.call(registry,'actionRepairCohort'),false);

const tasks=[
 {taskId:'x',shortName:'ACTERR',title:'Read GitHub Actions errors'},
 {taskId:'wake',title:'Wake the whole system'},
 {taskId:'a',title:'Twin A repair analysis'},
 {taskId:'b',title:'Twin B alternative analysis'},
 {taskId:'s',title:'Select the best repair option'}
];
for(const task of tasks){
 const result=selectBotForTask(task);
 assert.equal(result.status,'ASSIGNED');
 assert.match(result.botId,/^CELL-\d{3}$/u);
 assert.equal(result.executionMode,'GENERAL_EXECUTOR');
 assert.equal(result.sameIncidentContext,false);
}
console.log('CELL_CONTROLLER_SEPARATION=PASS');
