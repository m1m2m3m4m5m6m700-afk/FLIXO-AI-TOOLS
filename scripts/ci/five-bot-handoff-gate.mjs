#!/usr/bin/env node
import fs from 'node:fs';
const arg=(name,fallback='')=>{const p='--'+name+'=';const hit=process.argv.find(v=>v.startsWith(p));return hit?hit.slice(p.length):String(fallback)};
const packetPath=arg('packet'),targetSha=arg('sha'),expected=Number(arg('expected-cohort'));
if(!packetPath||!fs.existsSync(packetPath)) throw new Error('FIVE_BOT_HANDOFF_PACKET_REQUIRED');
if(!/^[a-f0-9]{40}$/iu.test(targetSha)) throw new Error('FIVE_BOT_HANDOFF_SHA_INVALID');
if(!Number.isInteger(expected)||expected<0||expected>19) throw new Error('FIVE_BOT_HANDOFF_EXPECTED_COHORT_INVALID');
const report=JSON.parse(fs.readFileSync(packetPath,'utf8'));
if(report.targetSha!==targetSha) throw new Error('FIVE_BOT_HANDOFF_PACKET_SHA_MISMATCH');
if(report.nextCohortReady!==true) throw new Error('FIVE_BOT_HANDOFF_DECLARATION_NOT_READY');
if(((Number(report.cohortIndex)+1)%20)!==expected) throw new Error('FIVE_BOT_HANDOFF_SEQUENCE_INVALID');
if(!Array.isArray(report.nextBotIds)||report.nextBotIds.length!==5) throw new Error('FIVE_BOT_HANDOFF_NEXT_FIVE_MISSING');
const expectedIds=[...report.nextBotIds].sort();
const readyIds=[...new Set((report.workers??[]).filter(w=>w?.active===false&&w?.cohortRole==='NEXT_COHORT_READY'&&w?.readySignal===true&&w?.readyExactSha===targetSha&&report.nextBotIds.includes(w.logicalBotId)).map(w=>w.logicalBotId))].sort();
if(readyIds.length!==5||readyIds.some((id,i)=>id!==expectedIds[i])) throw new Error('FIVE_BOT_HANDOFF_READY_FIVE_INVALID');
const result={schemaVersion:1,protocol:'FLIXO-FIVE-BOT-HANDOFF-v1',targetSha,sourceCohortIndex:Number(report.cohortIndex),targetCohortIndex:expected,requiredReadyCount:5,readyCount:5,readyBotIds:readyIds,status:'HANDOFF_COMMITTED',sleep:false,idle:false,sourceMutationAllowed:false};
const out=arg('output','/tmp/flixo-five-bot-handoff.json');
fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n'); console.log(JSON.stringify(result,null,2));
