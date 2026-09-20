#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const arg=(n,f='')=>{const p='--'+n+'=';const v=process.argv.find(x=>x.startsWith(p));return v?v.slice(p.length):f};
const greenPath=arg('green-report');
const shaArg=arg('sha');
const externalRoot=arg('activity-root');
if(!greenPath)throw new Error('ACTION_AGENT_HISTORY_PROMOTION_GREEN_REPORT_REQUIRED');

const read=(p,d=null)=>fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):d;
const write=(p,v)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n')};
const green=read(path.resolve(ROOT,greenPath),null);
if(!green)throw new Error('ACTION_AGENT_HISTORY_PROMOTION_GREEN_REPORT_NOT_FOUND');
if(green.status!=='GREEN')throw new Error('ACTION_AGENT_HISTORY_PROMOTION_REQUIRES_GREEN');
const targetSha=shaArg||green.executionSha;
if(!/^[a-f0-9]{40}$/u.test(String(targetSha)))throw new Error('ACTION_AGENT_HISTORY_PROMOTION_EXACT_SHA_REQUIRED');
if(green.executionSha!==targetSha)throw new Error('ACTION_AGENT_HISTORY_PROMOTION_SHA_MISMATCH');

const root=path.join(ROOT,'docs/agents/historical-action-errors/agent-activity');
const indexPath=path.join(root,'index.json');
const ix=read(indexPath,{schemaVersion:1,records:[],byFingerprint:{},byAgent:{},byClass:{}});
let promoted=0;
for(const summary of ix.records??[]){
  if(summary.status!=='PROVISIONAL'||summary.targetSha!==targetSha)continue;
  const file=path.resolve(ROOT,summary.file||path.join('docs/agents/historical-action-errors/agent-activity',summary.id+'.json'));
  const record=read(file,null);
  if(!record||record.targetSha!==targetSha)continue;
  record.status='VERIFIED';
  record.authority='verified-historical-agent-activity';
  record.green={
    recordId:green.recordId??('GREEN-'+targetSha),
    source:'DAILY_FLIXO_GREEN_GATE',
    conclusion:'success',
    zeroRed:true,
    exactShaVerified:true,
    targetSha,
    recordedAt:green.recordedAt??new Date().toISOString()
  };
  record.promotedAt=new Date().toISOString();
  write(file,record);
  summary.status='VERIFIED';
  summary.promotedAt=record.promotedAt;
  promoted++;
}
ix.updatedAt=new Date().toISOString();
write(indexPath,ix);
console.log(JSON.stringify({status:'PASS',promotion:'VERIFIED_HISTORICAL_AGENT_ACTIVITY',targetSha,promoted},null,2));
