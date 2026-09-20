#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { recordAttempt, recordFailedAttempt, recordHandoff, recordPredictionGenerated } from './action-failure-ledger.mjs';
import { buildPrediction } from './action-historical-predictor.mjs';
import { selectFileScope } from './action-file-selection-intelligence.mjs';

const ROOT=process.cwd();
const VAULT=path.resolve(ROOT,'diagnostics/auto-repair/action-vault');
const PROFILE=path.join(VAULT,'ACTION-THREE-BOT-INTELLIGENCE.json');
const STATE=path.join(VAULT,'current-collaboration.json');
const CHAT_PROTOCOL='diagnostics/auto-repair/action-vault/CHAT-PROTOCOL.md';
const BOTS=Object.freeze(['ACTION-REPAIR','ACTION-REPAIR-2','ACTION-HISTORIAN-3']);
const LANES=Object.freeze({
  'ACTION-REPAIR':'PROGRAMMER_THINKING_AND_BOUNDED_SOURCE_REPAIR',
  'ACTION-REPAIR-2':'HISTORICAL_INDEX_EXPLORATION_AND_REPAIR_PREDICTION',
  'ACTION-HISTORIAN-3':'FILE_SELECTION_INTELLIGENCE_AND_FAILURE_LEARNING'
});
const PHASES=Object.freeze(['PARALLEL_DISCOVERY','FILE_SELECTION','PARALLEL_ANALYSIS','CROSS_LEARNING','CHALLENGE','SYNTHESIS','PATCH_SYNTHESIS','SANDBOX_SIMULATION','DIFFERENTIAL_VERIFICATION','OWNER_MUTATION','VERIFICATION','GREEN_LEARNING','CLOSED']);
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
const fileSelectionPath=String(arg('file-selection')).trim();
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
if(profile.roleMatrix?.['ACTION-REPAIR']?.mission!=='THINK_AS_PROGRAMMER_AND_APPLY_BOUNDED_SOURCE_REPAIR') throw new Error('ACTION_THREE_BOT_PROGRAMMER_ROLE_INVALID');
if(!/THINK_AS_PROGRAMMER_AND_INDEPENDENTLY_RECONSTRUCT_AND_CHALLENGE_THE_PRIMARY_REPAIR/u.test(profile.roleMatrix?.['ACTION-REPAIR-2']?.mission||'')) throw new Error('ACTION_THREE_BOT_PROGRAMMER_TWIN_ROLE_INVALID');
if(profile.parity?.programmerTwinIntelligenceEqual!==true) throw new Error('ACTION_THREE_BOT_PROGRAMMER_TWIN_PARITY_NOT_DECLARED');
if(profile.roleMatrix?.['ACTION-HISTORIAN-3']?.mission!=='SELECT_AND_EXCLUDE_THE_MINIMAL_FILE_SURFACE_FROM_PATH_LEVEL_EVIDENCE_THEN_RECORD_FAILURE_LEARNING') throw new Error('ACTION_THREE_BOT_FILE_SELECTION_ROLE_INVALID');
if(profile.cooperation?.fileSelectionIntelligence?.runtime!=='scripts/ci/action-file-selection-intelligence.mjs') throw new Error('ACTION_THREE_BOT_FILE_SELECTION_RUNTIME_INVALID');
if(profile.cooperation?.enabled!==true) throw new Error('ACTION_THREE_BOT_COOPERATION_DISABLED');
if(JSON.stringify(profile.cooperation.participants)!==JSON.stringify(BOTS)) throw new Error('ACTION_THREE_BOT_PARTICIPANT_SET_INVALID');
if(profile.cooperation.authority?.noParallelSourceMutation!==true) throw new Error('ACTION_THREE_BOT_PARALLEL_SOURCE_MUTATION_FORBIDDEN');
if(profile.cooperation?.repairEngineering?.enabled!==true) throw new Error('ACTION_THREE_BOT_REPAIR_ENGINEERING_DISABLED');
if(profile.cooperation?.repairEngineering?.owner!=='ACTION-REPAIR') throw new Error('ACTION_THREE_BOT_REPAIR_ENGINEERING_OWNER_INVALID');

const execFileList=(command)=>execFileSync(command[0],command.slice(1),{encoding:'utf8'}).split('\\0').filter(Boolean);
const buildSelection=()=>{
  const selection=fileSelectionPath&&fs.existsSync(fileSelectionPath)
    ? JSON.parse(fs.readFileSync(fileSelectionPath,'utf8'))
    : selectFileScope({
        taskId:task,failureFingerprint:fingerprint,targetSha,failedRunId:runId,
        trackedFiles:execFileList(['git','ls-files','-z']),
        changedFiles:execFileList(['git','diff-tree','--no-commit-id','--name-only','-r',targetSha]),
        failureLog:logPath&&fs.existsSync(logPath)?fs.readFileSync(logPath,'utf8'):''
      });
  if(selection.agentId!=='ACTION-HISTORIAN-3'||selection.protocol!=='ACTION-FILE-SELECTION-INTELLIGENCE-v1'||selection.targetSha!==targetSha||selection.failureFingerprint!==fingerprint||selection.pathOnlyAnalysis!==true||selection.codeContentRead!==false||selection.sourceMutationAllowed!==false||selection.decision!=='SELECTED'||!Array.isArray(selection.selectedFiles)||selection.selectedFiles.length<1) throw new Error('ACTION_THREE_BOT_FILE_SELECTION_INVALID');
  return selection;
};
const ensureState=()=>{
  const fileSelection=buildSelection();
  if(fs.existsSync(STATE)){
    const state=read();
    if(state.taskId!==task||state.failureFingerprint!==fingerprint||state.targetSha!==targetSha||state.failedRunId!==runId) throw new Error('ACTION_THREE_BOT_COLLAB_ACTIVE_IDENTITY_MISMATCH');
    if(state.fileSelectionDecision?.targetSha!==targetSha||state.fileSelectionDecision?.failureFingerprint!==fingerprint) throw new Error('ACTION_THREE_BOT_FILE_SELECTION_STATE_MISMATCH');
    return state;
  }
  const log=logPath&&fs.existsSync(logPath)?fs.readFileSync(logPath,'utf8'):'';
  const state={
    schemaVersion:2,
    id:'ACTION-THREE-BOT-COLLABORATION',
    protocol:'ACTION-VAULT-PARALLEL-COLLABORATION-v1',
    status:'ACTIVE',
    phase:'FILE_SELECTION',
    taskId:task,
    failedRunId:runId,
    failureFingerprint:fingerprint,
    targetSha,
    exactShaBound:true,
    participants:BOTS.map(id=>({id,lane:LANES[id],required:true,status:'ASSIGNED',contributionReceived:false,exchangeReceived:false,challengeIssued:false,learnedFromPeers:false})),
    sharedEvidence:{failureLog:logPath||null,failureSignalCount:(log.match(/(?:error|failure|failed|fatal|timeout|exception)/giu)||[]).length,actionIndex4000:'diagnostics/auto-repair/action-vault/ACTION-INDEX-4000.json',historicalIndex:'docs/agents/historical-action-errors/index.json',repairMemory:'diagnostics/auto-repair/memory.json',teachingRouter:'docs/agents/ERROR-TEACHING-ROUTER.json',inferentialIntelligence:'docs/agents/INFERENTIAL-REPAIR-INTELLIGENCE.md'},
    parallelProtocol:{phases:[...PHASES],independentWorkRequired:true,crossLearningRequired:true,exchangeBeforeMutation:true,allThreeMustContributeBeforeMutation:true,oneActiveMutationOwner:true,mutationOwner:'ACTION-REPAIR',programmerTwin:'ACTION-REPAIR-2',historian:'ACTION-HISTORIAN-3',mutationWindow:'OWNER_ONLY_AFTER_EXCHANGE',greenClosesMission:true},
    contributions:{},
    exchange:{status:'PENDING',digest:null,at:null,receipts:{}},
    challenge:{status:'PENDING',checks:[]},
    fileSelectionDecision:fileSelection,
    authorization:{status:'BLOCKED',owner:null,authorizedAt:null,reason:'WAITING_FOR_FILE_SELECTION_AND_ALL_THREE_CONTRIBUTIONS_AND_CROSS_LEARNING'},
    greenRecord:null,
    outputs:{hypotheses:[],challenges:[],selectedRepair:null,regression:null,handoff:null,lessons:[],antiLessons:[],fileSelectionDecision:fileSelection},
    collaborationRules:{sameTask:true,sameFingerprint:true,sameSha:true,evidenceExchangeBeforeMutation:true,fileSelectionBeforeProgramming:true,programmerOnlyForCodeReasoning:true},
    createdAt:now(),updatedAt:now()
  };
  write(state); return state;
};

let state=ensureState();

if(op==='start'){
  state.phase='FILE_SELECTION';state.status='ACTIVE';state.updatedAt=now();write(state);
} else if(op==='contribute'){
  validBot(bot);
  if(!summary) throw new Error('ACTION_THREE_BOT_CONTRIBUTION_SUMMARY_REQUIRED');
  if(!['OBSERVATION','RCA','HYPOTHESIS','CHALLENGE','PLAN','EVIDENCE','LESSON_CANDIDATE','PROGRAMMING_ANALYSIS','HISTORICAL_PREDICTION','PROPOSED_REPAIR','FAILURE_RECORD','HANDOFF_RECORD','FILE_SELECTION'].includes(kind)) throw new Error('ACTION_THREE_BOT_CONTRIBUTION_KIND_INVALID');
  if(bot==='ACTION-REPAIR' && !['PROGRAMMING_ANALYSIS','RCA','HYPOTHESIS','PLAN'].includes(kind)) throw new Error('ACTION_THREE_BOT_PROGRAMMER_CONTRIBUTION_INVALID');
  if(bot==='ACTION-REPAIR-2' && !['PROGRAMMING_ANALYSIS','RCA','HYPOTHESIS','PLAN','PROPOSED_REPAIR','CHALLENGE'].includes(kind)) throw new Error('ACTION_THREE_BOT_PROGRAMMER_TWIN_CONTRIBUTION_INVALID');
  if(bot==='ACTION-HISTORIAN-3' && !['FAILURE_RECORD','HANDOFF_RECORD','EVIDENCE','FILE_SELECTION'].includes(kind)) throw new Error('ACTION_THREE_BOT_HISTORIAN_CONTRIBUTION_INVALID');
  const contributionId=bot+'-'+shaDigest(task+'|'+fingerprint+'|'+targetSha+'|'+bot+'|'+summary).slice(0,20);
  state.contributions[bot]={contributionId,bot,lane:LANES[bot],kind,summary:summary.slice(0,12000),evidence,targetSha,fingerprint,createdAt:now(),verified:false};
  recordAttempt({taskId:task,failureFingerprint:fingerprint,targetSha,failedRunId:runId,botId:bot,attemptedStrategy:summary.slice(0,1000),result:'CONTRIBUTION_RECORDED',evidence});
  const member=state.participants.find(x=>x.id===bot);member.contributionReceived=true;member.status='CONTRIBUTED';
  state.phase='PARALLEL_ANALYSIS';state.updatedAt=now();write(state);
} else if(op==='exchange'){
  for(const id of BOTS) if(!state.contributions[id]) throw new Error('ACTION_THREE_BOT_EXCHANGE_WAITING_FOR='+id);
  const packet=JSON.stringify(BOTS.map(id=>state.contributions[id]));
  const digest=shaDigest(packet);
  state.exchange={status:'COMPLETE',digest,at:now(),receipts:Object.fromEntries(BOTS.map(id=>[id,{receivedAll:true,receivedAt:now(),peerCount:2,digest}]))};
  for(const member of state.participants){member.exchangeReceived=true;member.learnedFromPeers=true;member.challengeIssued=true;}
  state.phase='CHALLENGE';state.updatedAt=now();write(state);
} else if(op==='predict' || op==='programmer-twin'){
  if(bot!=='ACTION-REPAIR-2') throw new Error('ACTION_THREE_BOT_PROGRAMMER_TWIN_ONLY');
  const supportingHistory=buildPrediction({taskId:task,fingerprint,targetSha,failedRunId:runId,failureLog:logPath&&fs.existsSync(logPath)?fs.readFileSync(logPath,'utf8'):'',workflow:arg('workflow',''),job:arg('job','')});
  const twin={
    protocol:'ACTION-PROGRAMMER-TWIN-PARITY-v1',
    role:'EXACT_PROGRAMMER_TWIN',
    status:'PROVISIONAL_INDEPENDENT_PROGRAMMER_ANALYSIS',
    taskId:task,failureFingerprint:fingerprint,targetSha,failedRunId:runId,
    sameProgrammingIntelligenceAs:'ACTION-REPAIR',
    sourceMutationAllowed:false,
    independentReasoningRequired:true,
    historicalEvidence:supportingHistory,
    challengeRequirements:['ALTERNATIVE_ROOT_CAUSES','CANDIDATE_PATCH','REGRESSION_PREDICTION','COUNTERFACTUAL_CHALLENGE'],
    generatedAt:now()
  };
  state.outputs.programmerTwinAnalysis=twin;
  state.programmerTwin={status:'PROVISIONAL',analysisDigest:shaDigest(JSON.stringify(twin)),role:'EXACT_PROGRAMMER_TWIN',mutationAuthority:false};
  recordAttempt({taskId:task,failureFingerprint:fingerprint,targetSha,failedRunId:runId,botId:'ACTION-REPAIR-2',attemptedStrategy:'PROGRAMMER_TWIN_ANALYSIS',result:'PROGRAMMER_TWIN_ANALYSIS_RECORDED',evidence});
  state.phase='CROSS_LEARNING';state.updatedAt=now();write(state);
} else if(op==='authorize-mutation'){
  const owner=validBot(arg('owner'));
  if(owner==='ACTION-HISTORIAN-3') throw new Error('ACTION_THREE_BOT_HISTORIAN_CANNOT_MUTATE');
  for(const id of BOTS) if(!state.contributions[id]) throw new Error('ACTION_THREE_BOT_MUTATION_BLOCKED_MISSING_CONTRIBUTION='+id);
  if(state.exchange.status!=='COMPLETE') throw new Error('ACTION_THREE_BOT_MUTATION_BLOCKED_EXCHANGE_INCOMPLETE');
  if(state.fileSelectionDecision?.decision!=='SELECTED'||state.fileSelectionDecision?.targetSha!==targetSha||state.fileSelectionDecision?.failureFingerprint!==fingerprint) throw new Error('ACTION_THREE_BOT_MUTATION_BLOCKED_FILE_SELECTION');
  if(state.participants.some(x=>!x.learnedFromPeers)) throw new Error('ACTION_THREE_BOT_MUTATION_BLOCKED_CROSS_LEARNING_INCOMPLETE');
  if(owner!=='ACTION-REPAIR') throw new Error('ACTION_THREE_BOT_ONLY_PROGRAMMER_OWNER_MAY_MUTATE');
  if(!state.outputs.programmerTwinAnalysis && !state.contributions['ACTION-REPAIR-2']) throw new Error('ACTION_THREE_BOT_MUTATION_BLOCKED_NO_PROGRAMMER_TWIN_ANALYSIS');
  state.authorization={status:'AUTHORIZED',owner,authorizedAt:now(),reason:'PROGRAMMER_OWNER_AFTER_HISTORICAL_PREDICTION_AND_HISTORIAN_RECORD',targetSha};
  state.phase='OWNER_MUTATION';state.updatedAt=now();write(state);
} else if(op==='record-failure'){
  if(bot!=='ACTION-HISTORIAN-3') throw new Error('ACTION_THREE_BOT_FAILURE_RECORD_ONLY_HISTORIAN');
  const failureSummary=summary||'UNSPECIFIED_FAILURE';
  recordFailedAttempt({taskId:task,failureFingerprint:fingerprint,targetSha,failedRunId:runId,botId:'ACTION-HISTORIAN-3',notes:failureSummary,attemptedStrategy:arg('strategy',''),evidence});
  state.outputs.lessons.push({type:'FAILURE',summary:failureSummary,evidence,at:now()});
  state.updatedAt=now();write(state);
} else if(op==='handoff'){
  recordHandoff({taskId:task,failureFingerprint:fingerprint,targetSha,failedRunId:runId,botId:'ACTION-HISTORIAN-3',notes:summary,evidence});
  state.outputs.handoff={summary:summary||null,evidence,at:now()};state.updatedAt=now();write(state);
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

const result={status:'PASS',protocol:'ACTION-VAULT-PARALLEL-COLLABORATION-v1',op,taskId:task,fingerprint,targetSha,phase:state.phase,authorization:state.authorization,exchange:state.exchange,fileSelectionDecision:state.fileSelectionDecision,collaborationRules:state.collaborationRules,contributionBots:Object.keys(state.contributions),sharedArtifact:STATE};
fs.writeFileSync(output,JSON.stringify(state,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
