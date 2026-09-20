#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const VAULT=path.resolve(ROOT,'diagnostics/auto-repair/action-vault');
const PROFILE=path.join(VAULT,'ACTION-THREE-BOT-INTELLIGENCE.json');
const STATE=path.join(VAULT,'current-collaboration.json');

const arg=(name, fallback='')=>{
  const prefix='--'+name+'=';
  const hit=process.argv.find(v=>v.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
};
const task=String(arg('task')).trim();
const fingerprint=String(arg('fingerprint')).trim();
const targetSha=String(arg('sha')).trim();
const runId=String(arg('run-id')).trim();
const logPath=String(arg('log')).trim();
const output=String(arg('output','/tmp/action-three-bot-collaboration.json')).trim();

if(!task || !fingerprint || !/^[a-f0-9]{40}$/u.test(targetSha) || !runId){
  throw new Error('ACTION_THREE_BOT_COLLAB_IDENTITY_REQUIRED');
}
if(!fs.existsSync(PROFILE)) throw new Error('ACTION_THREE_BOT_INTELLIGENCE_PROFILE_MISSING');
const profile=JSON.parse(fs.readFileSync(PROFILE,'utf8'));
if(profile.parity?.cognitiveCapabilitiesEqual !== true || profile.parity?.knowledgeSourcesEqual !== true){
  throw new Error('ACTION_THREE_BOT_CAPABILITY_PARITY_INVALID');
}
if(profile.cooperation?.enabled !== true) throw new Error('ACTION_THREE_BOT_COOPERATION_DISABLED');
const expected=['ACTION-REPAIR','ACTION-REPAIR-2','ACTION-HISTORIAN-3'];
if(JSON.stringify(profile.cooperation.participants) !== JSON.stringify(expected)){
  throw new Error('ACTION_THREE_BOT_PARTICIPANT_SET_INVALID');
}
const log=logPath && fs.existsSync(logPath) ? fs.readFileSync(logPath,'utf8') : '';
const failureSignal=(log.match(/(?:error|failure|failed|fatal|timeout|exception)/giu)||[]).length;
const state={
  schemaVersion:1,
  id:'ACTION-THREE-BOT-COLLABORATION',
  status:'ACTIVE',
  taskId:task,
  failedRunId:runId,
  failureFingerprint:fingerprint,
  targetSha,
  exactShaBound:true,
  participants:[
    {id:'ACTION-HISTORIAN-3', assignment:'INTAKE_INDEX_FIRST_SEEN_AND_CONTINUOUS_RECORD', mutation:false, required:true, status:'ASSIGNED'},
    {id:'ACTION-REPAIR-2', assignment:'INDEPENDENT_RCA_INFERENCE_COUNTER_HYPOTHESIS', mutation:'ONLY_WHEN_OWNER', required:true, status:'ASSIGNED'},
    {id:'ACTION-REPAIR', assignment:'RCA_SYNTHESIS_BOUNDED_REPAIR_TARGETED_REGRESSION', mutation:'OWNER_ONLY', required:true, status:'ASSIGNED'}
  ],
  sharedEvidence:{
    failureLog:logPath || null,
    failureSignalCount:failureSignal,
    actionIndex4000:'diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json',
    historicalIndex:'docs/agents/historical-action-errors/index.json',
    repairMemory:'diagnostics/auto-repair/memory.json',
    teachingRouter:'docs/agents/ERROR-TEACHING-ROUTER.json',
    inferentialIntelligence:'docs/agents/INFERENTIAL-REPAIR-INTELLIGENCE.md'
  },
  collaborationRules:{
    sameTask:true,
    sameFingerprint:true,
    sameSha:true,
    evidenceExchangeBeforeMutation:true,
    historianAlwaysAttached:true,
    oneActiveMutationOwner:true,
    failoverOnlyAfterDocumentedFailure:true,
    greenAuthority:'DAILY_FLIXO_GREEN_GATE'
  },
  outputs:{
    hypotheses:[],
    challenges:[],
    selectedRepair:null,
    regression:null,
    handoff:null,
    lessons:[],
    antiLessons:[]
  },
  createdAt:new Date().toISOString(),
  updatedAt:new Date().toISOString()
};
fs.mkdirSync(VAULT,{recursive:true});
fs.writeFileSync(STATE,JSON.stringify(state,null,2)+'\n');
fs.writeFileSync(output,JSON.stringify(state,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',taskId:task,targetSha,participants:expected,sharedArtifact:STATE},null,2));
