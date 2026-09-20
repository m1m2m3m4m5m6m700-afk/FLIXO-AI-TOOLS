#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildMentorPacket } from './action-code-mentor.mjs';
import { buildSoftwareEngineerPacket } from './action-software-engineer-core.mjs';
import { buildPrediction } from './action-historical-predictor.mjs';
import { buildRepairEngineeringPlan, executeRepairEngineering } from './action-repair-engineering.mjs';
import { buildCausalDiscriminator } from './action-causal-discriminator.mjs';
import { buildMetaCausalModel } from './meta-causal-model.mjs';

const ROOT=process.cwd();
const arg=(name,fallback='')=>{const p='--'+name+'=';const v=process.argv.find(x=>x.startsWith(p));return v?v.slice(p.length):fallback};
const task=arg('task');
const fingerprint=arg('fingerprint');
const targetSha=arg('sha');
const runId=arg('run-id');
const logPath=arg('log');
const output=arg('output','/tmp/action-agent-runtime.json');

const MODEL_DEFAULTS=Object.freeze({
  ACTION_COMMANDER_V1:{modelProfile:'FRONTIER_REASONING',reasoningEffort:'HIGH',toolCalling:true,structuredOutput:true,selfCritique:true,independentReview:true},
  ACTION_PRIMARY_REPAIR_V1:{modelProfile:'FRONTIER_REASONING',reasoningEffort:'HIGH',toolCalling:true,structuredOutput:true,selfCritique:true,independentReview:true},
  ACTION_ADVERSARIAL_REPAIR_V1:{modelProfile:'FRONTIER_REASONING_ADVERSARIAL',reasoningEffort:'HIGH',toolCalling:true,structuredOutput:true,selfCritique:true,independentReview:true},
  ACTION_FRONTIER_REPAIR_V2:{modelProfile:'FRONTIER_CODING_REASONING',reasoningEffort:'MAXIMUM',toolCalling:true,structuredOutput:true,selfCritique:true,independentReview:true},
  ACTION_HISTORICAL_EXPLORER_V2:{modelProfile:'FRONTIER_HISTORICAL_REASONING',reasoningEffort:'MAXIMUM',toolCalling:true,structuredOutput:true,selfCritique:true,independentReview:true},
  ACTION_FAILURE_HISTORIAN_V2:{modelProfile:'FRONTIER_FORENSIC_REASONING',reasoningEffort:'HIGH',toolCalling:true,structuredOutput:true,selfCritique:true,independentReview:true}
});

const readJson=(p,d)=>fs.existsSync(p)?JSON.parse(fs.readFileSync(p,'utf8')):d;
const sha256=(v)=>crypto.createHash('sha256').update(String(v),'utf8').digest('hex');
const must=(ok,msg)=>{if(!ok)throw new Error(msg)};
must(task,'ACTION_AGENT_RUNTIME_TASK_REQUIRED');
must(fingerprint,'ACTION_AGENT_RUNTIME_FINGERPRINT_REQUIRED');
must(/^[a-f0-9]{40}$/u.test(targetSha),'ACTION_AGENT_RUNTIME_EXACT_SHA_REQUIRED');
must(runId,'ACTION_AGENT_RUNTIME_RUN_ID_REQUIRED');

const historyIndex=readJson(path.join(ROOT,'docs/agents/historical-action-errors/index.json'),{byFingerprint:{},byNormalized:{},byClass:{},byWorkflow:{},recordCount:0});
const actionMemory=readJson(path.join(ROOT,'diagnostics/auto-repair/memory.json'),{cases:[],actionHistory:[],lessons:[],antiLessons:[]});
const activityIndex=readJson(path.join(ROOT,'docs/agents/historical-action-errors/agent-activity/index.json'),{byFingerprint:{},records:[]});
const failureLog=logPath&&fs.existsSync(logPath)?fs.readFileSync(logPath,'utf8'):'';

const ansiEscape=new RegExp(String.fromCharCode(27)+'\\[[0-?]*[ -/]*[@-~]','g');
const normalizedLog=failureLog.replace(ansiEscape,'').replace(/\\b\\d{10,}\\b/g,'<ID>').replace(/\\b[a-f0-9]{40}\\b/gi,'<SHA>').replace(/\\s+/g,' ').trim().slice(0,16000);
const currentFeatures=[...new Set((normalizedLog.match(/[A-Za-z][A-Za-z0-9_-]{2,}/g)||[]).slice(0,120))];

const exactHistoricalIds=historyIndex.byFingerprint?.[fingerprint]??[];
const exactCases=(actionMemory.cases??[]).filter(x=>x.fingerprint===fingerprint);
const historicalActivityIds=activityIndex.byFingerprint?.[fingerprint]??[];
const historicalActivity=(activityIndex.records??[]).filter(x=>historicalActivityIds.includes(x.id)).slice(-20);
const candidateCases=(actionMemory.cases??[]).filter(x=>x.fingerprint!==fingerprint && (x.features??[]).some(f=>currentFeatures.includes(f))).slice(-50);

const strategyHistory=(exactCases.flatMap(x=>[
  ...(x.successfulStrategies??[]).map(s=>({strategy:s,status:'SUCCESS'})),
  ...(x.failedStrategies??[]).map(s=>({strategy:s,status:'REJECTED'})),
  ...(x.rules??[]).map(s=>({strategy:s,status:'HISTORICAL_RULE'}))
])).slice(-100);
const doNotRepeat=[...new Set(strategyHistory.filter(x=>x.status==='REJECTED').map(x=>x.strategy).filter(Boolean))];

const evidenceItems=[
  {id:'CURRENT_FAILURE_LOG',strength:failureLog?1:0,required:true,binding:'CURRENT_RUN'},
  {id:'EXACT_TARGET_SHA',strength:/^[a-f0-9]{40}$/u.test(targetSha)?1:0,required:true,binding:targetSha},
  {id:'HISTORICAL_EXACT_FINGERPRINT',strength:exactHistoricalIds.length?0.9:0.2,required:false,binding:fingerprint},
  {id:'HISTORICAL_ACTIVITY',strength:historicalActivity.length?0.85:0.1,required:false,binding:fingerprint},
  {id:'CURRENT_CANONICAL_CI',strength:0,required:true,binding:'PROVE_AFTER_REPAIR'}
];

const phases=['INTAKE','CONTEXT_RETRIEVAL','PLAN','SYNTHESIZE','SIMULATE','EXECUTE','SELF_CHECK','INDEPENDENT_REVIEW','DIFFERENTIAL_VERIFY','VERIFY','LEARN'];
const lanes={
  CHIEF:{agentId:'ACTION-MASTER',profile:'ACTION_COMMANDER_V1',lane:'ORCHESTRATION_AND_TOOL_SELECTION'},
  PRIMARY:{agentId:'ACTION-REPAIR',profile:'ACTION_FRONTIER_REPAIR_V2',lane:'PROGRAMMER_THINKING_AND_SOURCE_REPAIR'},
  ADVERSARIAL:{agentId:'ACTION-REPAIR-2',profile:'ACTION_HISTORICAL_EXPLORER_V2',lane:'HISTORICAL_INDEX_EXPLORATION_AND_PREDICTION'},
  HISTORIAN:{agentId:'ACTION-HISTORIAN-3',profile:'ACTION_FAILURE_HISTORIAN_V2',lane:'FAILURE_LEDGER_AND_LEARNING_RECORDING'}
};

const causalDiscriminator=buildCausalDiscriminator({
  failureLog:normalizedLog,
  exactCases,
  doNotRepeat,
  fingerprint,
  targetSha,
});
const metaCausalModel=buildMetaCausalModel({
  failureLog:normalizedLog,
  targetSha,
  currentHeadSha:process.env.FLIXO_CURRENT_HEAD_SHA ?? targetSha,
  failedRunId:runId,
  taskId:task,
  branch:process.env.FLIXO_MUTATION_BRANCH ?? 'execution',
  historicalKnowledge:[],
  exactCases,
  doNotRepeat,
});
const hypothesisBase=causalDiscriminator.hypotheses.slice(0,12);

const toolBudget={
  maxToolCalls:36,
  maxHistoricalRecords:150,
  maxMessagesPerAgent:300,
  maxCandidateHypotheses:12,
  stopOnRepeatedStrategy:true,
  stopOnEvidenceMismatch:true,
  parallelReadsAllowed:true,
  parallelMutationAllowed:false,
  maxCandidatePatches:12,
  maxSandboxCandidates:6,
  maxSandboxChecks:12,
  maxCausalHypotheses:12,
  minHypothesisSeparation:0.08,
  causalDiscriminatorProtocol:'CAUSAL-DISCRIMINATOR-v1',
  metaCausalProtocol:'META-CAUSAL-MODEL-v1',
  causalObservabilityInvariant:'The repair system must preserve trustworthy causal observability while evidence, authority, time, boundaries and learning remain coherent.'
};

const mentorPaths=(process.env.FLIXO_ACTION_CODE_MENTOR_PATHS??'').split(',').map((x)=>x.trim()).filter(Boolean);
const softwareEngineerCore=buildSoftwareEngineerPacket({
  taskId:task,
  fingerprint,
  targetSha,
  failedRunId:runId,
  baseSha:process.env.FLIXO_BASE_SHA,
  paths:mentorPaths,
  deep:true
});
const historicalPrediction=buildPrediction({
  taskId:task,
  fingerprint,
  targetSha,
  failedRunId:runId,
  failureLog,
  workflow:process.env.FLIXO_FAILED_WORKFLOW??'',
  job:process.env.FLIXO_FAILED_JOB??''
});
const repairCandidatesRaw=process.env.FLIXO_REPAIR_CANDIDATES??'';
let repairCandidates=[];
if(repairCandidatesRaw){
  try{
    const parsed=JSON.parse(repairCandidatesRaw);
    must(Array.isArray(parsed),'ACTION_AGENT_RUNTIME_REPAIR_CANDIDATES_NOT_ARRAY');
    repairCandidates=parsed.slice(0,toolBudget.maxCandidatePatches);
  }catch(error){
    throw new Error('ACTION_AGENT_RUNTIME_REPAIR_CANDIDATES_INVALID:'+String(error?.message??error),{cause:error});
  }
}
const repairEngineeringPlan=buildRepairEngineeringPlan({taskId:task,fingerprint,targetSha,candidates:repairCandidates});
let repairEngineeringExecution=null;
if(repairCandidates.length && process.env.FLIXO_RUN_REPAIR_SIMULATION==='1'){
  repairEngineeringExecution=executeRepairEngineering({repoRoot:ROOT,taskId:task,fingerprint,targetSha,candidates:repairCandidates.slice(0,toolBudget.maxSandboxCandidates)});
}

const codeMentor=buildMentorPacket({
  taskId:task,
  fingerprint,
  targetSha,
  failedRunId:runId,
  sourceFiles:mentorPaths,
  mode:'TEACH'
});
const safety={
  exactShaRequired:true,
  evidenceFirst:true,
  unknownsExplicit:true,
  selfCritiqueRequired:true,
  independentReviewRequired:true,
  noSelfApproval:true,
  noCertificationAuthority:true,
  failClosed:true,
  structuredOutputRequired:true,
  noMainMutation:true,
  noTestMutation:true,
  singleActiveMutationOwner:true,
  externalFailureNeverBecomesSourceRepair:true
};

const profileConfig=(profile)=>MODEL_DEFAULTS[profile]??MODEL_DEFAULTS.ACTION_PRIMARY_REPAIR_V1;
const runtime={
  schemaVersion:1,
  protocol:'ACTION-AGENT-RUNTIME-v2',
  status:metaCausalModel.mutationAllowed ? 'READY' : 'FAIL_CLOSED',
  identity:{taskId:task,failureFingerprint:fingerprint,targetSha,failedRunId:runId,identityDigest:sha256(task+'|'+fingerprint+'|'+targetSha+'|'+runId)},
  modelProfiles:Object.fromEntries(Object.values(lanes).map((agent)=>[agent.agentId,{...agent,config:profileConfig(agent.profile)}])),
  cognitiveLoop:phases,
  historicalContext:{
    exactFingerprintRecordIds:exactHistoricalIds,
    exactCases,
    historicalActivity,
    candidateCases,
    doNotRepeat,
    corpusRecordCount:Number(historyIndex.recordCount??0),
    memoryCaseCount:Number((actionMemory.cases??[]).length),
    actionHistoryCount:Number((actionMemory.actionHistory??[]).length)
  },
  evidence:{items:evidenceItems,minimumActionableScore:0.8,proofAuthority:'DAILY_FLIXO_GREEN_GATE'},
  hypotheses:hypothesisBase,
  causalDiscriminator,
  metaCausalModel,
  governingRoot:metaCausalModel.governingRoot,
  mutationAllowedByMetaCausalModel:metaCausalModel.mutationAllowed,
  selectedStrategy:causalDiscriminator.ranking.selectedStrategy,
  selectionConfidence:causalDiscriminator.capabilityScore,
  codeMentor:{requiredByActionRepair:true,packet:codeMentor},
  historicalPrediction:{requiredByActionRepair:true,provider:'ACTION-REPAIR-2',packet:historicalPrediction},
  softwareEngineerCore:{requiredByActionRepair:true,provider:'ACTION-REPAIR',packet:softwareEngineerCore},
  repairEngineering:{requiredByActionRepair:true,provider:'ACTION-REPAIR',plan:repairEngineeringPlan,execution:repairEngineeringExecution},
  repairEngineeringPacket:repairEngineeringPlan,
  differentialVerification:repairEngineeringExecution?.simulations?.map((item)=>item.differential??null).filter(Boolean)??[],
  toolBudget,
  safety,
  lifecycle:{current:'INTAKE',next:'CONTEXT_RETRIEVAL',closure:'CANONICAL_GREEN_ONLY'},
  outputContract:{
    required:[ 'currentEvidence','unknowns','historicalMatches','candidateHypotheses','codeMentorPacket','historicalPredictionPacket','softwareEngineerCorePacket','repairEngineeringPacket','causalDiscriminator','metaCausalModel','governingRoot','selectedStrategy','selectionConfidence','selfCritique','independentReview','targetedRegression','exactSha','canonicalGreen' ],
    selectedStrategyMayBeNull:true,
    mutationMayBeNull:true
  },
  generatedAt:new Date().toISOString(),
  engineeringPolicy:{patchSynthesis:true,sandboxSimulation:true,differentialVerification:true,automaticMutation:false,canonicalGreenOnly:true}
};
fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});
fs.writeFileSync(path.resolve(output),JSON.stringify(runtime,null,2)+'\n');
console.log(JSON.stringify({status:'PASS',protocol:runtime.protocol,targetSha,fingerprint,selectedStrategy:runtime.selectedStrategy,selectionConfidence:runtime.selectionConfidence,causalProbeSuite:runtime.causalDiscriminator.probeSuite.passed,toolBudget:toolBudget.maxToolCalls,phase:runtime.lifecycle.current},null,2));
