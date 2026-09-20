#!/usr/bin/env node
import fs from 'node:fs';
import crypto from 'node:crypto';

const input=process.argv[2];
if(!input) throw new Error('CELL_FANOUT_INPUT_REQUIRED');
const plan=JSON.parse(fs.readFileSync(input,'utf8'));
const tasks=Array.isArray(plan.tasks)?plan.tasks:[];
if(tasks.length===0||tasks.length>50) throw new Error('CELL_FANOUT_TASK_COUNT_MUST_BE_1_TO_50');
if(!plan.planId||!Number.isInteger(plan.planVersion)||plan.planVersion<1||!/^[0-9a-f]{40}$/.test(String(plan.entrySha))) throw new Error('CELL_FANOUT_PLAN_INVALID');
const ids=new Set(), scopes=new Set();
const assignments=tasks.map((task,i)=>{
 const botId=\`CELL-${String(i+1).padStart(3,'0')}\`;
 if(ids.has(botId)) throw new Error('CELL_FANOUT_BOT_DUPLICATE');
 if(!task.taskId||!task.scope||!task.objective) throw new Error('CELL_FANOUT_TASK_FIELDS_REQUIRED');
 if(scopes.has(task.scope)) throw new Error('CELL_FANOUT_SCOPE_COLLISION='+task.scope);
 ids.add(botId); scopes.add(task.scope);
 return {botId,planId:plan.planId,planVersion:plan.planVersion,entrySha:plan.entrySha,taskId:task.taskId,scope:task.scope,objective:task.objective,expectedOutput:Array.isArray(task.expectedOutput)&&task.expectedOutput.length?task.expectedOutput:['evidence','result','knowledge']};
});
const batch={schemaVersion:1,batchId:'CELL-BATCH-'+crypto.randomUUID(),planId:plan.planId,planVersion:plan.planVersion,entrySha:plan.entrySha,parallel:true,maxConcurrent:50,assignments};
console.log(JSON.stringify(batch,null,2));
