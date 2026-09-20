#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT=process.cwd();
const REGISTRY_PATH=path.join(ROOT,'docs/agents/CELL-BOT-REGISTRY.json');
const SHA=/^[a-f0-9]{40}$/iu;
const DIFFICULTIES=Object.freeze({
  D1:[1,3],
  D2:[3,8],
  D3:[8,20],
  D4:[20,50],
  D5:[50,200],
});
const LADDER=Object.freeze([3,7,15,30,50,100,200]);

const readRegistry=()=>JSON.parse(fs.readFileSync(REGISTRY_PATH,'utf8'));
const clamp=(n,min,max)=>Math.min(max,Math.max(min,Number(n)||0));
const signalNumber=(value)=>clamp(Number(value??0),0,4);
const riskScore=Object.freeze({LOW:0,MEDIUM:1,HIGH:2,CRITICAL:4});

export function validateSwarmPolicy(registry){
  if(!registry||!Array.isArray(registry.bots)||registry.bots.length!==200)throw new Error('SWARM_REGISTRY_REQUIRES_200_BOTS');
  if(!registry.swarmPolicy||registry.swarmPolicy.registeredBots!==200)throw new Error('SWARM_POLICY_200_CONTRACT_MISSING');
  for(const [d,[min,max]] of Object.entries(DIFFICULTIES)){
    const actual=registry.swarmPolicy.difficultyRanges?.[d];
    if(!Array.isArray(actual)||actual[0]!==min||actual[1]!==max)throw new Error('SWARM_DIFFICULTY_RANGE_MISMATCH='+d);
  }
  if(JSON.stringify(registry.swarmPolicy.escalationLadder)!==JSON.stringify(LADDER))throw new Error('SWARM_ESCALATION_LADDER_MISMATCH');
  return registry.swarmPolicy;
}

export function deriveDifficulty({difficulty,risk='LOW',uncertainty=0,evidenceGap=0,conflict=0,historicalDifficulty=0}={}){
  if(DIFFICULTIES[difficulty])return String(difficulty);
  const score=(riskScore[String(risk).toUpperCase()]??0)+signalNumber(uncertainty)+signalNumber(evidenceGap)+signalNumber(conflict)+signalNumber(historicalDifficulty);
  if(score<=3)return 'D1';
  if(score<=7)return 'D2';
  if(score<=11)return 'D3';
  if(score<=15)return 'D4';
  return 'D5';
}

export function chooseSwarmSize({difficulty,risk='LOW',uncertainty=0,evidenceGap=0,conflict=0,historicalDifficulty=0,requestedSize}={}){
  const d=DIFFICULTIES[difficulty]??DIFFICULTIES.D1;
  if(requestedSize!=null){
    const requested=Math.floor(Number(requestedSize));
    if(!Number.isInteger(requested)||requested<d[0]||requested>d[1])throw new Error('SWARM_REQUESTED_SIZE_OUT_OF_DIFFICULTY_RANGE');
    return requested;
  }
  const intensity=clamp(
    (riskScore[String(risk).toUpperCase()]??0)+signalNumber(uncertainty)+signalNumber(evidenceGap)+signalNumber(conflict)+signalNumber(historicalDifficulty),
    0,16,
  )/16;
  return Math.floor(d[0]+(d[1]-d[0])*intensity);
}

function capabilityScore(bot,capabilities=[]){
  const wanted=new Set((Array.isArray(capabilities)?capabilities:[]).map(x=>String(x).trim().toUpperCase()).filter(Boolean));
  const learned=new Set([...(bot.learnedCapabilities??[]),String(bot.taskIdentity?.shortName??'')].map(x=>String(x).trim().toUpperCase()).filter(Boolean));
  let score=0;
  for(const capability of wanted)if(learned.has(capability))score+=10;
  score+=Math.max(0,100-Number(bot.upgradeTarget?.upgradePriority??50))/100;
  if(bot.currentAssignment==null)score+=2;
  return score;
}

export function assignRoles(size,{requestedRoles=[]}={}){
  const defaults=['EXECUTOR','INVESTIGATOR','CHALLENGER','REVIEWER','META-REVIEWER','SIMULATOR'];
  const roles=(Array.isArray(requestedRoles)&&requestedRoles.length?requestedRoles:defaults);
  return Array.from({length:size},(_,i)=>roles[i%roles.length]);
}

export function planMission({taskId,missionId,objective,scope,exactSha,difficulty,risk='LOW',uncertainty=0,evidenceGap=0,conflict=0,historicalDifficulty=0,requiredCapabilities=[],requestedSize,requestedRoles=[]}={}){
  if(!String(taskId??'').trim())throw new Error('SWARM_TASK_ID_REQUIRED');
  if(!String(missionId??'').trim())throw new Error('SWARM_MISSION_ID_REQUIRED');
  if(!String(objective??'').trim())throw new Error('SWARM_OBJECTIVE_REQUIRED');
  if(!String(scope??'').trim())throw new Error('SWARM_SCOPE_REQUIRED');
  if(!SHA.test(String(exactSha??'')))throw new Error('SWARM_EXACT_SHA_REQUIRED');
  const registry=readRegistry();
  const policy=validateSwarmPolicy(registry);
  const resolvedDifficulty=deriveDifficulty({difficulty,risk,uncertainty,evidenceGap,conflict,historicalDifficulty});
  const size=chooseSwarmSize({difficulty:resolvedDifficulty,risk,uncertainty,evidenceGap,conflict,historicalDifficulty,requestedSize});
  const eligible=registry.bots.filter(bot=>bot.currentAssignment==null&&['RAW','LEARNING','SPECIALIZING','UPGRADING','READY'].includes(bot.status));
  if(eligible.length<size)throw new Error('SWARM_INSUFFICIENT_ELIGIBLE_BOTS');
  const selected=eligible
    .map(bot=>({bot,score:capabilityScore(bot,requiredCapabilities)}))
    .sort((a,b)=>b.score-a.score||String(a.bot.id).localeCompare(String(b.bot.id)))
    .slice(0,size);
  const roles=assignRoles(size,{requestedRoles});
  const assignments=selected.map(({bot,score},i)=>({
    botId:bot.id,
    role:roles[i],
    score:Number(score.toFixed(3)),
    taskId:String(taskId),
    missionId:String(missionId),
    scope:String(scope),
    objective:String(objective),
    difficulty:resolvedDifficulty,
    exactSha:String(exactSha),
    leaseRequired:true,
    heartbeatRequired:true,
    ownershipLock:'ONE_BOT_ONE_TASK_ONE_SCOPE',
    sourceMutationParallelism:false,
  }));
  const digest=crypto.createHash('sha256').update(JSON.stringify({taskId,missionId,objective,scope,exactSha,resolvedDifficulty,size,assignments}),'utf8').digest('hex');
  return {
    schemaVersion:1,
    authority:'CELL_SWARM_CONTROLLER',
    controller:policy.controller,
    mutationAuthority:false,
    certificationAuthority:false,
    missionId:String(missionId),
    taskId:String(taskId),
    exactSha:String(exactSha),
    difficulty:resolvedDifficulty,
    requestedSignals:{risk,uncertainty:signalNumber(uncertainty),evidenceGap:signalNumber(evidenceGap),conflict:signalNumber(conflict),historicalDifficulty:signalNumber(historicalDifficulty)},
    swarmSize:size,
    difficultyRange:DIFFICULTIES[resolvedDifficulty],
    assignments,
    expansion:LADDER.find(x=>x>size)??null,
    closure:'CANONICAL_GREEN_ONLY',
    digest,
  };
}

export function adaptAfterResults({difficulty,currentSize,agreement=0,conflict=0,uncertainty=0,evidenceGap=0}={}){
  if(!DIFFICULTIES[difficulty])throw new Error('SWARM_DIFFICULTY_INVALID');
  const [min,max]=DIFFICULTIES[difficulty];
  const size=Math.floor(Number(currentSize));
  if(size<min||size>max)throw new Error('SWARM_CURRENT_SIZE_INVALID');
  const strongAgreement=Number(agreement)>=0.8&&Number(conflict)===0&&Number(uncertainty)<=1&&Number(evidenceGap)<=1;
  if(strongAgreement)return {action:'STOP_FOR_REVIEW',nextSize:size,reason:'STRONG_AGREEMENT'};
  const next=LADDER.find(x=>x>size&&x>=min);
  if(next==null||next>max)return {action:'BLOCK',nextSize:size,reason:'MAX_SWARM_REACHED_WITHOUT_SUFFICIENT_EVIDENCE'};
  return {action:'EXPAND',nextSize:next,reason:Number(conflict)>0?'CONFLICT':Number(evidenceGap)>1?'EVIDENCE_GAP':'UNCERTAINTY'};
}

if(import.meta.url===`file://${process.argv[1]}`){
  const input=JSON.parse(process.argv[2]??'{}');
  console.log(JSON.stringify(planMission(input),null,2));
}
