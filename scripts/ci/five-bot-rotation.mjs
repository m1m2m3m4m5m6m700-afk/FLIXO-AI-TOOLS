#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { AGENT_LIVENESS_PROTOCOL } from './agent-liveness-protocol.mjs';

const SHA_PATTERN=/^[a-f0-9]{40}$/iu;
const WINDOW_MS=AGENT_LIVENESS_PROTOCOL.activeCohortCommitmentMs;
const COHORT_SIZE=AGENT_LIVENESS_PROTOCOL.activeCohortSize;
const COHORT_COUNT=AGENT_LIVENESS_PROTOCOL.activeCohortCount;
const LOGICAL_IDS=AGENT_LIVENESS_PROTOCOL.logicalBotIds;
const ACTIVE_RUNTIME_IDS=AGENT_LIVENESS_PROTOCOL.activeRuntimeIds;
const STAGED_RUNTIME_IDS=AGENT_LIVENESS_PROTOCOL.stagedRuntimeIds;

export function cohortMembers(cohortIndex){
  const index=Number(cohortIndex);
  if(!Number.isInteger(index)||index<0||index>=COHORT_COUNT) throw new Error('FIVE_BOT_COHORT_INDEX_INVALID');
  return Object.freeze(LOGICAL_IDS.slice(index*COHORT_SIZE,index*COHORT_SIZE+COHORT_SIZE));
}
export function cohortIndexAt(nowMs){
  const value=Number(nowMs);
  if(!Number.isFinite(value)||value<0) throw new Error('FIVE_BOT_TIMESTAMP_INVALID');
  return Math.floor(value/WINDOW_MS)%COHORT_COUNT;
}
export function evaluateHandoff({fromCohortIndex,toCohortIndex,readyBotIds=[],elapsedMs,targetSha}={}){
  if(!SHA_PATTERN.test(String(targetSha??''))) throw new Error('FIVE_BOT_HANDOFF_EXACT_SHA_REQUIRED');
  const from=Number(fromCohortIndex),to=Number(toCohortIndex);
  if(!Number.isInteger(from)||from<0||from>=COHORT_COUNT||!Number.isInteger(to)||to<0||to>=COHORT_COUNT) throw new Error('FIVE_BOT_HANDOFF_COHORT_INVALID');
  const expected=[...cohortMembers(to)].sort();
  const ready=[...new Set((Array.isArray(readyBotIds)?readyBotIds:[]).map(String))].sort();
  if(Number(elapsedMs)<WINDOW_MS) return Object.freeze({status:'WAIT_COMMITMENT',reason:'ACTIVE_COHORT_15_MINUTES_NOT_ELAPSED',requiredReadyCount:COHORT_SIZE,readyCount:ready.length,fromCohortIndex:from,toCohortIndex:to,targetSha:String(targetSha)});
  if(ready.length!==COHORT_SIZE||ready.some((id,i)=>id!==expected[i])) return Object.freeze({status:'WAIT_NEXT_COHORT_READY',reason:'NEXT_FIVE_NOT_READY',requiredReadyCount:COHORT_SIZE,readyCount:ready.length,requiredReadyBotIds:expected,readyBotIds:ready,fromCohortIndex:from,toCohortIndex:to,targetSha:String(targetSha)});
  return Object.freeze({status:'HANDOFF_COMMITTED',reason:'NEXT_FIVE_READY',requiredReadyCount:COHORT_SIZE,readyCount:ready.length,requiredReadyBotIds:expected,readyBotIds:ready,fromCohortIndex:from,toCohortIndex:to,targetSha:String(targetSha)});
}
export function buildFiveBotRotation({targetSha,now=new Date().toISOString()}={}){
  if(!SHA_PATTERN.test(String(targetSha??''))) throw new Error('FIVE_BOT_ROTATION_EXACT_SHA_REQUIRED');
  const parsed=Date.parse(String(now));
  if(!Number.isFinite(parsed)) throw new Error('FIVE_BOT_ROTATION_TIME_INVALID');
  const slotOrdinal=Math.floor(parsed/WINDOW_MS);
  const cohortIndex=((slotOrdinal%COHORT_COUNT)+COHORT_COUNT)%COHORT_COUNT;
  const nextIndex=(cohortIndex+1)%COHORT_COUNT;
  const cycleNumber=Math.floor(slotOrdinal/COHORT_COUNT)+1;
  const elapsedMs=Math.max(0,parsed-slotOrdinal*WINDOW_MS);
  const activeBotIds=cohortMembers(cohortIndex),nextBotIds=cohortMembers(nextIndex);
  const assignments=activeBotIds.map((logicalBotId,index)=>Object.freeze({logicalBotId,runtimeId:ACTIVE_RUNTIME_IDS[index],active:true}));
  return Object.freeze({
    schemaVersion:1,protocol:'FLIXO-FIVE-BOT-ROTATION-v1',targetSha:String(targetSha),generatedAt:new Date(parsed).toISOString(),
    logicalBotCount:LOGICAL_IDS.length,activeBotCount:COHORT_SIZE,stagedBotCount:LOGICAL_IDS.length-COHORT_SIZE,cohortCount:COHORT_COUNT,
    cohortIndex,cohortNumber:cohortIndex+1,cycleNumber,cycleOrdinal:slotOrdinal,commitmentWindowMs:WINDOW_MS,commitmentWindowMinutes:WINDOW_MS/60000,
    elapsedMs,remainingMs:Math.max(0,WINDOW_MS-elapsedMs),activeBotIds:[...activeBotIds],
    stagedBotIds:LOGICAL_IDS.filter(id=>!activeBotIds.includes(id)),nextBotIds:[...nextBotIds],
    activeRuntimeCount:ACTIVE_RUNTIME_IDS.length,activeRuntimeIds:[...ACTIVE_RUNTIME_IDS],stagedRuntimeCount:STAGED_RUNTIME_IDS.length,stagedRuntimeIds:[...STAGED_RUNTIME_IDS],
    assignments,handoff:{policy:AGENT_LIVENESS_PROTOCOL.activeCohortHandoffPolicy,nextReady:true,requiredReadyCount:COHORT_SIZE,readyBotIds:[...nextBotIds],fromCohortIndex:cohortIndex,toCohortIndex:nextIndex,status:'STAGED_NEXT_COHORT'},
    cycleWrap:nextIndex===0,cycleBoundary:nextIndex===0,sleep:false,idle:false,mutationAuthority:false,sourceMutationAllowed:false,readOnlyWhenResident:true
  });
}
const arg=(name,fallback='')=>{const prefix='--'+name+'=';return process.argv.find(v=>v.startsWith(prefix))?.slice(prefix.length)??fallback};
if(import.meta.url===(new URL('file://'+process.argv[1])).href){
  try{
    if(process.argv[2]==='validate'){
      const sample=buildFiveBotRotation({targetSha:'a'.repeat(40),now:'2026-01-01T00:00:00Z'});
      console.log(JSON.stringify({status:'PASS',protocol:sample.protocol,activeBotCount:sample.activeBotCount,cohortCount:sample.cohortCount,commitmentWindowMs:sample.commitmentWindowMs},null,2));
    }else{
      const targetSha=String(arg('sha',process.env.FLIXO_TARGET_SHA)).trim();
      const now=String(arg('now',new Date().toISOString())).trim();
      const output=String(arg('output','/tmp/flixo-five-bot-rotation.json')).trim();
      const plan=buildFiveBotRotation({targetSha,now});
      fs.mkdirSync(path.dirname(output),{recursive:true});
      fs.writeFileSync(output,JSON.stringify(plan,null,2)+'\n');
      console.log(JSON.stringify({status:'PASS',activeBotCount:plan.activeBotCount,activeBotIds:plan.activeBotIds,nextBotIds:plan.nextBotIds,cycleNumber:plan.cycleNumber,output},null,2));
    }
  }catch(error){console.error('FIVE_BOT_ROTATION_BLOCK='+String(error?.message??error));process.exitCode=1;}
}