#!/usr/bin/env node
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';

const arg=(name,fallback='')=>{const p='--'+name+'=';const x=process.argv.find(v=>v.startsWith(p));return x?x.slice(p.length):fallback};
const agent=arg('agent');
const task=arg('task');
const sha=arg('sha');
const question=arg('question');
const obstacle=arg('obstacle','');
const evidence=arg('evidence','');
const risk=arg('risk','MEDIUM').toUpperCase();
const dispatch=arg('dispatch','false')==='true';
const output=arg('output','/tmp/'+(agent||'CELL')+'-master-consult.json');
if(!/^CELL-\d{3}$/u.test(agent)) throw new Error('CELL_MASTER_AGENT_INVALID');
if(!task) throw new Error('CELL_MASTER_TASK_REQUIRED');
if(!/^[0-9a-f]{40}$/u.test(sha)) throw new Error('CELL_MASTER_EXACT_SHA_REQUIRED');
if(!question) throw new Error('CELL_MASTER_QUESTION_REQUIRED');
if(!['LOW','MEDIUM','HIGH','CRITICAL'].includes(risk)) throw new Error('CELL_MASTER_RISK_INVALID');

const requestId='CELL-MASTER-'+agent+'-'+task+'-'+crypto.createHash('sha256').update(sha+'|'+question).digest('hex').slice(0,16);
const payload={requestKind:'MASTER_TEACHING_CONSULT',requestedByAgent:agent,taskId:task,question,obstacle:obstacle||null,evidence:evidence?evidence.split(',').map(x=>x.trim()).filter(Boolean):[],purpose:'REQUEST_MASTER_INTELLIGENCE_BEFORE_REPAIR_WASTE',requireTeaching:true,returnToAgent:agent,preserveInMissionMemory:true,promoteAfterVerification:true};
const request={schemaVersion:1,requestId,actor:agent,recipient:'assistantController',intent:'CELL_MASTER_TEACHING_CONSULT',taskId:task,entrySha:sha,risk,payload,expectedResponse:['masterDecision','teaching','recommendedNextAction','evidenceRequirements'],stopConditions:['STALE_SHA','CONFLICT','MASTER_UNAVAILABLE'],proofObligations:['EXACT_SHA_REVALIDATION','MASTER_RECEIPT'],externalRuntime:{primaryAccountId:'CHIEF',fallbackAccountId:'CHIEF',models:['CHIEF','WORKER_A','WORKER_B']}};
fs.mkdirSync(output.split('/').slice(0,-1).join('/')||'.',{recursive:true});
fs.writeFileSync(output,JSON.stringify(request,null,2)+'\n');
if(dispatch){
  execFileSync('gh',['workflow','run','cell-master-consult.yml','--repo','m1m2m3m4m5m6m700-afk/FLIXO-AI-TOOLS','--ref','execution','-f','agent='+agent,'-f','task='+task,'-f','entry_sha='+sha,'-f','risk='+risk,'-f','question='+question,'-f','obstacle='+obstacle,'-f','evidence='+evidence,'-f','request_id='+requestId],{stdio:'inherit'});
}
console.log(JSON.stringify({status:'PASS',requestId,agent,task,sha,dispatch,output},null,2));