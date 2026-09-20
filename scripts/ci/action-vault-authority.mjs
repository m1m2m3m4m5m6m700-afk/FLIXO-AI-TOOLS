#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const VAULT=path.resolve(ROOT,'diagnostics/auto-repair/action-vault');
const STATE=path.join(VAULT,'current-ownership.json');
const TASKS=path.join(VAULT,'tasks.jsonl');
const shaOk=v=>/^[a-f0-9]{40}$/u.test(String(v??''));
const now=()=>new Date().toISOString();
const read=()=>fs.existsSync(STATE)?JSON.parse(fs.readFileSync(STATE,'utf8')):{schemaVersion:1,authority:'ACTION_VAULT_TASK_OWNERSHIP',activeTaskId:null,ownerBot:'ACTION-REPAIR',state:'IDLE_NO_ACTIVE_TASK',turn:0};
const write=v=>{fs.mkdirSync(VAULT,{recursive:true});fs.writeFileSync(STATE,JSON.stringify(v,null,2)+'\n')};
const append=v=>{fs.mkdirSync(VAULT,{recursive:true});fs.appendFileSync(TASKS,JSON.stringify(v)+'\n')};
const arg=(n,f='')=>{const p='--'+n+'=';const x=process.argv.find(v=>v.startsWith(p));return x?x.slice(p.length):f};
const op=arg('op');
const task=arg('task');
const fp=arg('fingerprint');
const sha=arg('sha');
const outcome=arg('outcome','');
const current=read();

function assertIdentity(){if(!task||!fp||!shaOk(sha))throw new Error('ACTION_AUTHORITY_IDENTITY_REQUIRED')}
function actorOk(x){if(!['ACTION-REPAIR','ACTION-REPAIR-2'].includes(x))throw new Error('ACTION_AUTHORITY_UNKNOWN_BOT');return x}

if(op==='resolve'){
 assertIdentity();
 let owner=current.ownerBot;
 let state=current.state;
 let turn=Number(current.turn||0);
 if(!current.activeTaskId){
   owner='ACTION-REPAIR'; turn=1; state='ASSIGNED_PRIMARY';
 } else if(current.activeTaskId!==task||current.fingerprint!==fp||current.targetSha!==sha){
   throw new Error('ACTION_AUTHORITY_CONFLICT_ACTIVE_TASK');
 } else if(['failure','failed-repair','unrepaired','crashed','stale','proposal-only'].includes(outcome)){
   owner=current.ownerBot==='ACTION-REPAIR'?'ACTION-REPAIR-2':'ACTION-REPAIR';
   turn+=1; state='HANDOFF_AFTER_FAILURE';
 }
 const next={schemaVersion:1,authority:'ACTION_VAULT_TASK_OWNERSHIP',activeTaskId:task,ownerBot:actorOk(owner),turn,fingerprint:fp,targetSha:sha,state,assignedAt:current.assignedAt??now(),updatedAt:now(),handoffReason:outcome||null,next:'OWNER_MUST_WORK_UNTIL_FAILURE_OR_GREEN'};
 write(next);
 append({event:'AUTHORITY_RESOLVED',taskId:task,fingerprint:fp,targetSha:sha,ownerBot:owner,turn,outcome:outcome||null,at:next.updatedAt});
 console.log(JSON.stringify(next,null,2));process.exit(0);
}
if(op==='fail'){
 assertIdentity();
 if(current.activeTaskId!==task||current.fingerprint!==fp||current.targetSha!==sha)throw new Error('ACTION_AUTHORITY_ACTIVE_TASK_MISMATCH');
 if(current.ownerBot!==actorOk(arg('bot')))throw new Error('ACTION_AUTHORITY_NOT_OWNER');
 const nextOwner=current.ownerBot==='ACTION-REPAIR'?'ACTION-REPAIR-2':'ACTION-REPAIR';
 const next={...current,ownerBot:nextOwner,turn:Number(current.turn||1)+1,state:'HANDOFF_AFTER_FAILURE',handoffAt:now(),updatedAt:now(),handoffReason:String(outcome||'FAILED_REPAIR')};
 write(next);append({event:'AUTHORITY_HANDOFF',taskId:task,fingerprint:fp,targetSha:sha,from:current.ownerBot,to:nextOwner,reason:next.handoffReason,turn:next.turn,at:next.updatedAt});
 console.log(JSON.stringify(next,null,2));process.exit(0);
}
if(op==='green'){
 assertIdentity();
 if(current.activeTaskId!==task||current.fingerprint!==fp||current.targetSha!==sha)throw new Error('ACTION_AUTHORITY_ACTIVE_TASK_MISMATCH');
 const next={...current,activeTaskId:null,ownerBot:'ACTION-REPAIR',turn:0,state:'CLOSED_GREEN',closedAt:now(),updatedAt:now()};
 write(next);append({event:'AUTHORITY_CLOSED_GREEN',taskId:task,fingerprint:fp,targetSha:sha,turn:current.turn,at:next.updatedAt});
 console.log(JSON.stringify(next,null,2));process.exit(0);
}
if(op==='assert'){
 assertIdentity();
 if(current.activeTaskId!==task||current.fingerprint!==fp||current.targetSha!==sha)throw new Error('ACTION_AUTHORITY_ACTIVE_TASK_MISMATCH');
 const actor=actorOk(arg('bot'));
 if(actor!==current.ownerBot)throw new Error('ACTION_AUTHORITY_OWNER_MISMATCH');
 console.log(JSON.stringify({status:'PASS',authority:true,ownerBot:current.ownerBot,turn:current.turn,state:current.state,targetSha:sha,fingerprint:fp},null,2));process.exit(0);
}
throw new Error('ACTION_AUTHORITY_OP_INVALID');
