#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const ROOT=process.cwd();
const REGISTRY=path.resolve(ROOT,'docs/agents/CELL-BOT-REGISTRY.json');
const DIR=path.resolve(ROOT,'diagnostics/auto-repair/cell-attendance');
const LEDGER=path.join(DIR,'attendance.jsonl');
const SUMMARY=path.join(DIR,'upgrade-summary.json');
const argv=process.argv.slice(2), command=String(argv[0]??'').toLowerCase(), args=new Map();
for(let i=1;i<argv.length;i++){const t=argv[i];if(!t.startsWith('--'))continue;const e=t.indexOf('=');args.set(t.slice(2,e>=0?e:undefined),e>=0?t.slice(e+1):argv[i+1]??'');}
const arg=(n,d='')=>String(args.get(n)??d).trim();
const now=()=>new Date().toISOString();
const requireField=(v,n)=>{if(!String(v).trim())throw new Error('CELL_ATTENDANCE_REQUIRED_'+n.toUpperCase());};
const sha=(v,n)=>{if(!/^[0-9a-f]{40}$/u.test(v))throw new Error('CELL_ATTENDANCE_'+n.toUpperCase()+'_SHA_INVALID');};
const read=()=>fs.existsSync(LEDGER)?fs.readFileSync(LEDGER,'utf8').split('\n').filter(Boolean).map(JSON.parse):[];
const append=(v)=>{fs.mkdirSync(DIR,{recursive:true});fs.appendFileSync(LEDGER,JSON.stringify(v)+'\n');};
const closedIds=()=>new Set(read().filter(e=>e.type==='CHECK_OUT').map(e=>e.attendanceId));
const openFor=(bot)=>{const c=closedIds();return read().filter(e=>e.type==='CHECK_IN'&&e.botId===bot&&!c.has(e.attendanceId));};
const registry=()=>JSON.parse(fs.readFileSync(REGISTRY,'utf8'));
const checkBot=(bot)=>{if(!/^CELL-\d{3}$/u.test(bot))throw new Error('CELL_ATTENDANCE_BOT_INVALID');if(!registry().bots.some(b=>b.id===bot))throw new Error('CELL_ATTENDANCE_BOT_UNKNOWN='+bot);};
function checkIn(){
  const botId=arg('bot'),taskId=arg('task'),planId=arg('plan'),scope=arg('scope'),objective=arg('objective'),entrySha=arg('sha'),planVersion=Number(arg('plan-version','1'));
  checkBot(botId); [taskId,planId,scope,objective,entrySha].forEach((v,i)=>requireField(v,['task','plan','scope','objective','sha'][i])); sha(entrySha,'entry');
  if(!Number.isInteger(planVersion)||planVersion<1)throw new Error('CELL_ATTENDANCE_PLAN_VERSION_INVALID');
  if(openFor(botId).length)throw new Error('CELL_ATTENDANCE_OPEN_TASK_EXISTS='+botId);
  const attendanceId='ATT-'+randomUUID();
  append({schemaVersion:1,type:'CHECK_IN',attendanceId,botId,taskId,planId,planVersion,entrySha,scope,objective,presenceReason:arg('presence-reason','')||null,startedAt:now(),status:'ACTIVE',closedAt:null});
  console.log(JSON.stringify({status:'CHECKED_IN',attendanceId,botId,taskId,planId,planVersion,entrySha},null,2));
}
function checkOut(){
  const attendanceId=arg('attendance'),exitSha=arg('sha'),status=arg('status'),result=arg('result');
  const evidence=String(args.get('evidence')??'').split(',').map(v=>v.trim()).filter(Boolean),knowledgeId=arg('knowledge-id',''),nextAction=arg('next-action','');
  [attendanceId,exitSha,status,result].forEach((v,i)=>requireField(v,['attendance_id','exit_sha','status','result'][i])); sha(exitSha,'exit');
  if(!['COMPLETED','VERIFIED','BLOCKED','FAILED','ABORTED'].includes(status))throw new Error('CELL_ATTENDANCE_STATUS_INVALID');
  if((status==='COMPLETED'||status==='VERIFIED')&&!evidence.length)throw new Error('CELL_ATTENDANCE_EVIDENCE_REQUIRED');
  const entry=read().find(e=>e.type==='CHECK_IN'&&e.attendanceId===attendanceId&&!closedIds().has(attendanceId));
  if(!entry)throw new Error('CELL_ATTENDANCE_OPEN_RECORD_NOT_FOUND='+attendanceId);
  const finishedAt=now(),base=status==='VERIFIED'||status==='COMPLETED'?0:status==='BLOCKED'?20:35,knowledgePenalty=knowledgeId?0:10,presencePenalty=entry.presenceReason?10:0;
  const upgradeSignal=Math.min(100,base+knowledgePenalty+presencePenalty);
  append({...entry,type:'CHECK_OUT',finishedAt,closedAt:finishedAt,exitSha,status,result,evidence,knowledgeId:knowledgeId||null,nextAction:nextAction||null,durationMs:Math.max(0,Date.parse(finishedAt)-Date.parse(entry.startedAt)),upgradeSignal});
  console.log(JSON.stringify({status:'CHECKED_OUT',attendanceId,botId:entry.botId,taskId:entry.taskId,outcome:status,upgradeSignal},null,2));
}
function assess(){
  const rows=new Map();
  for(const e of read().filter(x=>x.type==='CHECK_OUT')){
    const r=rows.get(e.botId)??{botId:e.botId,tasks:0,verified:0,completed:0,blocked:0,failed:0,aborted:0,presence:0,missingKnowledge:0,signals:[]};
    r.tasks++; if(e.status==='VERIFIED')r.verified++; if(e.status==='COMPLETED')r.completed++; if(e.status==='BLOCKED')r.blocked++; if(e.status==='FAILED')r.failed++; if(e.status==='ABORTED')r.aborted++; if(e.presenceReason)r.presence++; if(!e.knowledgeId)r.missingKnowledge++; r.signals.push(Number(e.upgradeSignal??0)); rows.set(e.botId,r);
  }
  const output=[...rows.values()].map(r=>{const t=r.tasks,avg=t?r.signals.reduce((a,b)=>a+b,0)/t:0,fr=t?(r.failed+r.aborted)/t:0,br=t?r.blocked/t:0,kg=t?r.missingKnowledge/t:0,upgradePriority=Math.min(100,Math.round(avg+fr*30+br*15+kg*10));const status=t<2?'NEEDS_MORE_EVIDENCE':upgradePriority>=60?'UPGRADE_RECOMMENDED':upgradePriority>=30?'COACHING_RECOMMENDED':'STABLE';return {...r,failureRate:fr,blockRate:br,knowledgeGapRate:kg,upgradePriority,status};}).sort((a,b)=>b.upgradePriority-a.upgradePriority||a.botId.localeCompare(b.botId));
  fs.mkdirSync(DIR,{recursive:true});fs.writeFileSync(SUMMARY,JSON.stringify({schemaVersion:1,generatedAt:now(),rule:'Objective attendance/outcome/knowledge evidence only',rows:output},null,2)+'\n');
  console.log(JSON.stringify({generatedAt:now(),agents:output.length,upgradeRecommended:output.filter(r=>r.status==='UPGRADE_RECOMMENDED').map(r=>r.botId),rows:output},null,2));
}
if(!['check-in','check-out','assess'].includes(command))throw new Error('Usage: cell-attendance.mjs check-in|check-out|assess');
if(command==='check-in')checkIn(); if(command==='check-out')checkOut(); if(command==='assess')assess();
