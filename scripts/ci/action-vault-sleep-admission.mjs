#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const arg=(name,f='')=>{const p='--'+name+'=';const x=process.argv.find(v=>v.startsWith(p));return x?x.slice(p.length):f};
const taskId=arg('task');
const fingerprint=arg('fingerprint');
const targetSha=arg('target-sha');
const recordFile=arg('green-record');
const requestedState=arg('state','SLEEP').toUpperCase();

if(!taskId || !fingerprint || !/^[a-f0-9]{40}$/u.test(targetSha)) throw new Error('ACTION_VAULT_RESIDENCY_IDENTITY_REQUIRED');

if(recordFile){
  const file=path.resolve(ROOT,recordFile);
  if(!fs.existsSync(file)) throw new Error('ACTION_VAULT_GREEN_RECORD_NOT_FOUND');
  JSON.parse(fs.readFileSync(file,'utf8'));
}

const result={
  status:'BLOCKED',
  protocol:'ACTION-VAULT-PERMANENT-RESIDENCY-v1',
  admission:'DENIED_PERMANENTLY',
  taskId,
  fingerprint,
  targetSha,
  requestedState,
  rules:{
    sleep:false,
    idle:false,
    freeze:false,
    withdrawal:false,
    leaveVault:false
  },
  requiredState:'READY_RESIDENT',
  reason:'ACTION_VAULT_AGENTS_MUST_REMAIN_RESIDENT; MISSION_CLOSURE_OR_GREEN_DOES_NOT_CREATE_A_SLEEP_OR_WITHDRAWAL_STATE'
};
console.log(JSON.stringify(result,null,2));

// This executable intentionally exits successfully after proving the attempted
// transition is blocked. Callers must treat admission.status=BLOCKED as refusal,
// never as permission to suspend an agent.
