#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const VAULT=path.resolve(ROOT,'diagnostics/auto-repair/action-vault');
const PROFILE=path.join(VAULT,'ACTION-THREE-BOT-INTELLIGENCE.json');
const STATE=path.join(VAULT,'current-collaboration.json');
const CHAT_PROTOCOL='diagnostics/auto-repair/action-vault/CHAT-PROTOCOL.md';
const BOTS=Object.freeze(['ACTION-REPAIR','ACTION-REPAIR-2','ACTION-HISTORIAN-3']);
const LANES=Object.freeze({
  'ACTION-REPAIR':'PRIMARY_EXECUTION_RCA_AND_BOUNDED_REPAIR',
  'ACTION-REPAIR-2':'INDEPENDENT_RCA_CHALLENGE_AND_FALSIFICATION',
  'ACTION-HISTORIAN-3':'EVIDENCE_INTAKE_INDEX_PROVENANCE_AND_LEARNING'
});
const PHASES=Object.freeze(['PARALLEL_DISCOVERY','PARALLEL_ANALYSIS','CROSS_LEARNING','CHALLENGE','SYNTHESIS','OWNER_MUTATION','VERIFICATION','GREEN_LEARNING','CLOSED']);
const arg=(name,fallback='')=>{const p='--'+name+'=';const hit=process.argv.find(v=>v.startsWith(p));return hit?hit.slice(p.length):fallback};
const task=String(arg('task')).trim();
const fingerprint=String(arg('fingerprint')).trim();
const targetSha=String(arg('sha')).trim();
const runId=String(arg('run-id')).trim();
const logPath=String(arg('log')).trim();
const output=String(arg('output','/tmp/action-three-bot-collaboration.json')).trim();
const op=String(arg('op','start')).trim().toLowerCase();
const bot=String(arg('bot')).trim();
const summary=String(arg('summary')).trim();
const kind=String(arg('kind','OBSERVATION')).trim().toUpperCase();
const evidence=String(arg('evidence','')).split(',').map(x=>x.trim()).filter(Boolean);
const greenRecordPath=String(arg('green-record')).trim();
const now=()=>new Date().toISOString();
const read=()=>JSON.parse(fs.readFileSync(STATE,'utf8'));
const write=(value)=>{fs.mkdirSync(VAULT,{recursive:true});fs.writeFileSync(STATE,JSON.stringify(value,null,2)+'\n')};
const validIdentity=()=>{if(!task||!fingerprint||!/^[a-f0-9]{40}$/u.test(targetSha)||!runId) throw new Error('ACTION_THREE_BOT_COLLAB_IDENTITY_REQUIRED')};
const validBot=(value)=>{if(!BOTS.includes(value)) throw new Error('ACTION_THREE_BOT_COLLAB_BOT_INVALID='+value); return value};
const shaDigest=(value)=>crypto.createHash('sha256').update(String(value),'utf8').digest('hex');

validIdentity();
if(!fs.existsSync(PROFILE)) throw new Error('ACTION_THREE_BOT_INTELLIGENCE_PROFILE_MISSING');
if(!fs.existsSync(CHAT_PROTOCOL)) throw new Error('ACTION_THREE_BOT_CHAT_PROTOCOL_MISSING');
const profile=JSON.parse(fs.readFileSync(PROFILE,'utf8'));
if(profile.parity?.cognitiveCapabilitiesEqual!==true || profile.parity?.knowledgeSourcesEqual!==true || profile.parity?.challengeAccessEqual!==true) throw new Error('ACTION_THREE_BOT_CAPABILITY_PARITY_INVALID');
if(profile.cooperation?.enabled!==true) throw new Error('ACTION_THREE_BOT_COOPERATION_DISABLED');
if(JSON.stringify(profile.cooperation.participants)!==JSON.stringify(BOTS)) throw new Error('ACTION_THREE_BOT_PARTICIPANT_SET_INVALID');
if(profile.cooperation.authority?.noParallelSourceMutation!==true) throw new Error('ACTION_THREE_BOT_PARALLEL_SOURCE_MUTATION_FORBIDDEN');

const ensureState=()=>{
  if(fs.existsSync(STATE)){
    const state=read();
    if(state.taskId!==task||state.failureFingerprint!==fingerprint||state.targetSha!==targetSha||state.failedRunId!==runId) throw new Error('ACTION_THREE_BOT_COLLAB_ACTIVE_IDENTITY_MISMATCH');
    return state;
  }
  const log=logPath&&fs.existsSync(logPath)?fs.readFileSync(logPath,'utf8'):'';
  const state={
    schemaVersion:2,
    id:'ACTION-THREE-BOT-COLLABORATION',
    protocol:'ACTION-VAULT-PARALLEL-COLLABORATION-v1',
    status:'ACTIVE',
    phase:'PARALLEL_DISCOVERY',
    taskId:task,
    failedRunId:runId,
    failureFingerprint:fingerprint,
    targetSha,
    exactShaBound:true,
    participants:BOTS.map(id=>({id,lane:LANES[id],required:true,status:'ASSIGNED',contributionReceived:false,exchangeReceived:false,challengeIssued:false,learnedFromPeers:false})),
    sharedEvidence:{failureLog:logPath||null,failureSignalCount:(log.match(/(?:error|failure|failed|fatal|timeout|exception)/giu)||[]).length,actionIndex4000:'diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json',historicalIndex:'docs/agents/historical-action-errors/index.json',repairMemory:'diagnostics/auto-repair/memory.json',teachingRouter:'docs/agents/ERROR-TEACHING-ROUTER.json',inferentialIntelligence:'docs/agents/INFERENTIAL-REPAIR-INTELLIGENCE.md'},
    parallelProtocol:{phases:[...PHASES],independentWorkRequired:true,crossLearningRequired:true,exchangeBeforeMutation:true,allThreeMustContributeBeforeMutation:true,oneActiveMutationOwner:true,mutationWindow:'OWNER_ONLY_AFTER_EXCHANGE',greenClosesMission:true},
    contributions:{},
    exchange:{status:'PENDING',digest:null,at:null,receipts:{}},
    challenge:{status:'PENDING',checks:[]},
    authorization:{status:'BLOCKED',owner:null,authorizedAt:null,reason:'WAITING_FOR_ALL_THREE_CONTRIBUTIONS_AND_CROSS_LEARNING'},
    greenRecord:null,
    outputs:{hypotheses:[],challenges:[],selectedRepair:null,regression:null,handoff:null,lessons:[],antiLessons:[]},
    createdAt:now(),updatedAt:now()
  };
  write(state); return state;
};

let state=ensureState();

if(op==='start'){
  state.phase='PARALLEL_DISCOVERY';state.status='ACTIVE';state.updatedAt=now();write(state);
} else if(op==='contribute'){
  validBot(bot);
  if(!summary) throw new Error('ACTION_THREE_BOT_CONTRIBUTION_SUMMARY_REQUIRED');
  if(!['OBSERVATION','RCA','HYPOTHESIS','CHALLENGE','PLAN','EVIDENCE','LESSON_CANDIDATE'].includes(kind)) throw new Error('ACTION_THREE_BOT_CONTRIBUTION_KIND_INVALID');
  const contributionId=bot+'-'+shaDigest(task+'|'+fingerprint+'|'+targetSha+'|'+bot+'|'+summary).slice(0,20);
  state.contributions[bot]={contributionId,bot,lane:LANES[bot],kind,summary:summary.slice(0,12000),evidence,targetSha,fingerprint,createdAt:now(),verified:false};
  const member=state.participants.find(x=>x.id===bot);member.contributionReceived=true;member.status='CONTRIBUTED';
  state.phase='PARALLEL_ANALYSIS';state.updatedAt=now();write(state);
} else if(op==='exchange'){
  for(const id of BOTS) if(!state.contributions[id]) throw new Error('ACTION_THREE_BOT_EXCHANGE_WAITING_FOR='+id);
  const packet=JSON.stringify(BOTS.map(id=>state.contributions[id]));
  const digest=shaDigest(packet);
  state.exchange={status:'COMPLETE',digest,at:now(),receipts:Object.fromEntries(BOTS.map(id=>[id,{receivedAll:true,receivedAt:now(),peerCount:2,digest}]))};
  for(const member of state.participants){member.exchangeReceived=true;member.learnedFromPeers=true;member.challengeIssued=true;}
  state.phase='CHALLENGE';state.updatedAt=now();write(state);
} else if(op==='authorize-mutation'){
  const owner=validBot(arg('owner'));
  if(owner==='ACTION-HISTORIAN-3') throw new Error('ACTION_THREE_BOT_HISTORIAN_CANNOT_MUTATE');
  for(const id of BOTS) if(!state.contributions[id]) throw new Error('ACTION_THREE_BOT_MUTATION_BLOCKED_MISSING_CONTRIBUTION='+id);
  if(state.exchange.status!=='COMPLETE') throw new Error('ACTION_THREE_BOT_MUTATION_BLOCKED_EXCHANGE_INCOMPLETE');
  if(state.participants.some(x=>!x.learnedFromPeers)) throw new Error('ACTION_THREE_BOT_MUTATION_BLOCKED_CROSS_LEARNING_INCOMPLETE');
  state.authorization={status:'AUTHORIZED',owner,authorizedAt:now(),reason:'ALL_THREE_CONTRIBUTED_AND_EXCHANGE_COMPLETE',targetSha};
  state.phase='OWNER_MUTATION';state.updatedAt=now();write(state);
} else if(op==='green-close'){
  if(!greenRecordPath) throw new Error('ACTION_THREE_BOT_GREEN_RECORD_REQUIRED');
  const file=path.resolve(ROOT,greenRecordPath);
  if(!fs.existsSync(file)) throw new Error('ACTION_THREE_BOT_GREEN_RECORD_NOT_FOUND');
  const green=JSON.parse(fs.readFileSync(file,'utf8'));
  if(green.source!=='DAILY_FLIXO_GREEN_GATE'||green.conclusion!=='success'||green.zeroRed!==true||green.exactShaVerified!==true||green.targetSha!==targetSha||green.taskId!==task||green.fingerprint!==fingerprint) throw new Error('ACTION_THREE_BOT_GREEN_RECORD_INVALID');
  if(!green.recordId) throw new Error('ACTION_THREE_BOT_GREEN_RECORD_ID_REQUIRED');
  state.greenRecord={recordId:green.recordId,targetSha:green.targetSha,recordedAt:green.recordedAt,source:green.source};state.phase='GREEN_LEARNING';state.status='CLOSING_GREEN';state.updatedAt=now();write(state);
} else if(op==='close'){
  if(!state.greenRecord) throw new Error('ACTION_THREE_BOT_CLOSE_BLOCKED_NO_GREEN_RECORD');
  state.phase='CLOSED';state.status='CLOSED_GREEN';state.updatedAt=now();write(state);
} else throw new Error('ACTION_THREE_BOT_COLLAB_OPERATION_INVALID='+op);

const result={status:'PASS',protocol:'ACTION-VAULT-PARALLEL-COLLABORATION-v1',op,taskId:task,fingerprint,targetSha,phase:state.phase,authorization:state.authorization,exchange:state.exchange,contributionBots:Object.keys(state.contributions),sharedArtifact:STATE};
fs.writeFileSync(output,JSON.stringify(state,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
