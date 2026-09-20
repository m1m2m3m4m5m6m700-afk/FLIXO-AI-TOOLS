#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { sleepAdmission, idleAdmission } from './agent-liveness-protocol.mjs';

const ROOT=process.cwd();
const arg=(name,f='')=>{const p='--'+name+'=';const x=process.argv.find(v=>v.startsWith(p));return x?x.slice(p.length):f};
const taskId=arg('task');
const fingerprint=arg('fingerprint');
const targetSha=arg('target-sha');
const recordFile=arg('green-record');
const state=arg('state','SLEEP');

const readGreen=()=>{
  if(!recordFile) throw new Error('ACTION_VAULT_GREEN_RECORD_REQUIRED');
  const file=path.resolve(ROOT,recordFile);
  if(!fs.existsSync(file)) throw new Error('ACTION_VAULT_GREEN_RECORD_NOT_FOUND');
  return JSON.parse(fs.readFileSync(file,'utf8'));
};

if(!taskId || !fingerprint || !/^[a-f0-9]{40}$/u.test(targetSha)) throw new Error('ACTION_VAULT_SLEEP_IDENTITY_REQUIRED');

try{
  const greenRecord=readGreen();
  const result = state==='IDLE'
    ? idleAdmission({workAssigned:false,greenRecord,targetSha,taskId,fingerprint})
    : sleepAdmission({workAssigned:false,greenRecord,targetSha,taskId,fingerprint});
  console.log(JSON.stringify({
    status:'PASS',
    protocol:'ACTION-VAULT-SLEEP-ADMISSION-v1',
    admission:result,
    taskId,
    fingerprint,
    targetSha,
    greenRecordId:greenRecord.recordId
  },null,2));
}catch(error){
  console.error('ACTION_VAULT_SLEEP_ADMISSION_BLOCK='+String(error?.message??error));
  process.exit(1);
}
