#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const arg=(n,f='')=>{const p='--'+n+'=';const v=process.argv.find(x=>x.startsWith(p));return v?v.slice(p.length):f};
const task=arg('task');
const fingerprint=arg('fingerprint');
const sha=arg('sha');
const runId=arg('run-id');
const agent=arg('agent','ACTION-MASTER');
const lane=arg('lane','ORCHESTRATION');
const phase=arg('phase','INTAKE');
const status=arg('status','PROVISIONAL');
const summary=arg('summary');
const evidence=arg('evidence','').split(',').map(x=>x.trim()).filter(Boolean);
const output=arg('output','');
const greenRecord=arg('green-record','');

if(!task||!fingerprint||!/^[a-f0-9]{40}$/u.test(sha)||!runId||!summary)throw new Error('ACTION_AGENT_HISTORY_IDENTITY_AND_SUMMARY_REQUIRED');

const root=path.join(ROOT,'docs/agents/historical-action-errors/agent-activity');
const indexPath=path.join(root,'index.json');
const readJson=(p,d)=>fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):d;
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n')};
const hash=crypto.createHash('sha256').update(task+'|'+fingerprint+'|'+sha+'|'+runId+'|'+agent).digest('hex').slice(0,24);
const id='HAA-'+hash;
const now=new Date().toISOString();
const ix=readJson(indexPath,{schemaVersion:1,authority:'VERIFIED_HISTORICAL_AGENT_ACTIVITY_ONLY',records:[],byFingerprint:{},byAgent:{},byClass:{}});

let record=readJson(path.join(root,id+'.json'),null);
if(!record){
  record={schemaVersion:1,id,source:'ACTION_AGENT_RUNTIME',authority:'provisional-unless-green',taskId:task,fingerprint,targetSha:sha,failedRunId:runId,status:'PROVISIONAL',participants:[],timeline:[],evidence:[],lessons:[],antiLessons:[],createdAt:now,updatedAt:now};
}
record.participants=[...new Set([...(record.participants??[]),agent])];
record.timeline=[...(record.timeline??[]),{agent,lane,phase,status,summary:summary.slice(0,12000),evidence,targetSha:sha,at:now}].slice(-500);
record.evidence=[...new Set([...(record.evidence??[]),...evidence])];
record.updatedAt=now;

if(greenRecord){
  const green=readJson(path.resolve(ROOT,greenRecord),null);
  if(green?.source==='DAILY_FLIXO_GREEN_GATE'&&green?.conclusion==='success'&&green?.zeroRed===true&&green?.exactShaVerified===true&&green?.targetSha===sha&&green?.taskId===task&&green?.fingerprint===fingerprint){
    record.status='VERIFIED';
    record.authority='verified-historical-agent-activity';
    record.green={recordId:green.recordId,source:green.source,recordedAt:green.recordedAt,targetSha:green.targetSha};
  } else {
    throw new Error('ACTION_AGENT_HISTORY_GREEN_RECORD_INVALID');
  }
}

write(path.join(root,id+'.json'),record);
ix.records=[...(ix.records??[]).filter(x=>x.id!==id),{id,fingerprint,targetSha,taskId,failedRunId,status:record.status,participants:record.participants,timelineCount:record.timeline.length,file:path.relative(ROOT,path.join(root,id+'.json')),updatedAt:record.updatedAt}].slice(-5000);
ix.byFingerprint=ix.byFingerprint??{};
ix.byFingerprint[fingerprint]=[...(ix.byFingerprint[fingerprint]??[]).filter(x=>x!==id),id].slice(-100);
ix.byAgent=ix.byAgent??{};
for(const a of record.participants)ix.byAgent[a]=[...(ix.byAgent[a]??[]).filter(x=>x!==id),id].slice(-1000);
ix.updatedAt=now;
write(indexPath,ix);
if(output)write(path.resolve(ROOT,output),record);
console.log(JSON.stringify({status:'PASS',recordId:id,recordStatus:record.status,taskId,fingerprint,targetSha,agent,phase},null,2));
